import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
test('Postgres RLS prevents cross-organization access, self-promotion and unauthorized review',async()=>{
const db=new PGlite();try{
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated;`);
await db.exec(await readFile(new URL('../supabase/migrations/20261012085648_initial_access_and_projects.sql',import.meta.url),'utf8'));
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
await db.exec(`insert into auth.users values ('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}'); insert into public.organizations values ('${id(11)}','Ankara'),('${id(12)}','Başka il'); insert into public.memberships values ('${id(11)}','${id(1)}','officer'),('${id(11)}','${id(2)}','research'),('${id(12)}','${id(3)}','admin');`);
async function as(user,sql){await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id(user)}',false);`);try{return await db.query(sql);}finally{await db.exec('reset role');}}
const created=await as(1,`insert into public.projects(organization_id,created_by,title,summary,benefit) values('${id(11)}','${id(1)}','Pilot','Yöntem','Fayda') returning id`);const p=created.rows[0].id;
assert.equal((await as(2,'select * from projects')).rows.length,1);
assert.equal((await as(3,'select * from projects')).rows.length,0);
assert.equal((await as(4,'select * from projects')).rows.length,0);
await assert.rejects(as(1,`insert into memberships values('${id(11)}','${id(1)}','admin')`));
await assert.rejects(as(3,`insert into projects(organization_id,created_by,title,summary,benefit) values('${id(11)}','${id(3)}','X','X','X')`));
assert.equal((await as(1,`update projects set status='active',feedback='Yetkisiz' where id='${p}' returning id`)).rows.length,0);
await assert.rejects(as(2,`update projects set organization_id='${id(12)}' where id='${p}'`));
await assert.rejects(as(2,`update projects set status='active',feedback='' where id='${p}'`));
const reviewed=await as(2,`update projects set status='active',feedback='Pilot uygun' where id='${p}' and version=1 returning version,status`);assert.equal(reviewed.rows[0].version,2);assert.equal(reviewed.rows[0].status,'active');
assert.equal((await as(2,`update projects set status='revision',feedback='Eski kayıt' where id='${p}' and version=1 returning id`)).rows.length,0);
await db.exec(`delete from memberships where user_id='${id(2)}'`);assert.equal((await as(2,'select * from projects')).rows.length,0);
await db.exec('set role anon');await assert.rejects(db.query('select * from projects'));await db.exec('reset role');
}finally{await db.close();}});
