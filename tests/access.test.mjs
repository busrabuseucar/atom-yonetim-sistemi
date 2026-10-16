import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
test("Postgres RLS prevents cross-organization access, self-promotion and unauthorized review", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated;`,
    );
    for (const file of (
      await readdir(new URL("../supabase/migrations/", import.meta.url))
    )
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
    await db.exec(
      `insert into auth.users values ('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}'); insert into public.organizations values ('${id(11)}','Ankara'),('${id(12)}','Başka il'); insert into public.memberships values ('${id(11)}','${id(1)}','officer'),('${id(11)}','${id(2)}','research'),('${id(12)}','${id(3)}','admin');`,
    );
    async function as(user, sql) {
      await db.exec(
        `set role authenticated; select set_config('request.jwt.claim.sub','${id(user)}',false);`,
      );
      try {
        return await db.query(sql);
      } finally {
        await db.exec("reset role");
      }
    }
    const created = await as(
      1,
      `insert into public.projects(organization_id,created_by,title,summary,benefit) values('${id(11)}','${id(1)}','Pilot','Yöntem','Fayda') returning id`,
    );
    const p = created.rows[0].id;
    assert.equal((await as(2, "select * from projects")).rows.length, 1);
    assert.equal((await as(3, "select * from projects")).rows.length, 0);
    assert.equal((await as(4, "select * from projects")).rows.length, 0);
    await assert.rejects(
      as(1, `insert into memberships values('${id(11)}','${id(1)}','admin')`),
    );
    await assert.rejects(
      as(
        3,
        `insert into projects(organization_id,created_by,title,summary,benefit) values('${id(11)}','${id(3)}','X','X','X')`,
      ),
    );
    assert.equal(
      (
        await as(
          1,
          `update projects set status='active',feedback='Yetkisiz' where id='${p}' returning id`,
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      as(2, `update projects set organization_id='${id(12)}' where id='${p}'`),
    );
    await assert.rejects(
      as(2, `update projects set status='active',feedback='' where id='${p}'`),
    );
    const reviewed = await as(
      2,
      `update projects set status='active',feedback='Pilot uygun' where id='${p}' and version=1 returning version,status`,
    );
    assert.equal(reviewed.rows[0].version, 2);
    assert.equal(reviewed.rows[0].status, "active");
    assert.equal(
      (
        await as(
          2,
          `update projects set status='revision',feedback='Eski kayıt' where id='${p}' and version=1 returning id`,
        )
      ).rows.length,
      0,
    );
    await db.exec(`delete from memberships where user_id='${id(2)}'`);
    assert.equal((await as(2, "select * from projects")).rows.length, 0);
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from projects"));
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});

test("Revision lifecycle enforces content ownership, state and optimistic concurrency", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated;`,
    );
    for (const file of (
      await readdir(new URL("../supabase/migrations/", import.meta.url))
    )
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    const id = (n) => `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
    await db.exec(
      `insert into auth.users values ('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}'),('${id(5)}'); insert into organizations values ('${id(11)}','Test'); insert into memberships values ('${id(11)}','${id(1)}','officer'),('${id(11)}','${id(2)}','research'),('${id(11)}','${id(3)}','officer'),('${id(11)}','${id(4)}','viewer'),('${id(11)}','${id(5)}','admin');`,
    );
    async function as(user, sql) {
      await db.exec(
        `set role authenticated; select set_config('request.jwt.claim.sub','${id(user)}',false);`,
      );
      try {
        return await db.query(sql);
      } finally {
        await db.exec("reset role");
      }
    }
    const {
      rows: [project],
    } = await as(
      1,
      `insert into projects(organization_id,created_by,title,summary,benefit) values ('${id(11)}','${id(1)}','Original','Method','Benefit') returning id`,
    );
    const p = project.id;
    await t.test("review cannot rewrite proposal", async () => {
      await assert.rejects(
        as(
          2,
          `update projects set status='revision',feedback='Improve',title='Tampered' where id='${p}'`,
        ),
      );
      await as(
        2,
        `update projects set status='revision',feedback='Improve' where id='${p}' and version=1`,
      );
    });
    await t.test("other officer and viewer cannot resubmit", async () => {
      for (const user of [3, 4])
        assert.equal(
          (
            await as(
              user,
              `update projects set status='submitted',title='Wrong' where id='${p}' returning id`,
            )
          ).rows.length,
          0,
        );
    });
    await t.test(
      "author cannot erase feedback, skip review or submit unchanged content",
      async () => {
        await assert.rejects(
          as(
            1,
            `update projects set status='submitted',title='New',feedback='' where id='${p}'`,
          ),
        );
        await assert.rejects(
          as(
            1,
            `update projects set status='active',title='New' where id='${p}'`,
          ),
        );
        await assert.rejects(
          as(1, `update projects set status='submitted' where id='${p}'`),
        );
      },
    );
    await t.test(
      "author revises and stale version cannot overwrite",
      async () => {
        const result = await as(
          1,
          `update projects set status='submitted',title='Revised' where id='${p}' and version=2 returning version,feedback`,
        );
        assert.equal(result.rows[0].version, 3);
        assert.equal(result.rows[0].feedback, "Improve");
        assert.equal(
          (
            await as(
              2,
              `update projects set status='active',feedback='Stale' where id='${p}' and version=2 returning id`,
            )
          ).rows.length,
          0,
        );
      },
    );
    await t.test(
      "review completes cycle and active project cannot be edited",
      async () => {
        await as(
          2,
          `update projects set status='active',feedback='Suitable' where id='${p}' and version=3`,
        );
        assert.equal(
          (
            await as(
              1,
              `update projects set title='Changed' where id='${p}' returning id`,
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          as(5, `update projects set title='Admin edit' where id='${p}'`),
        );
        await assert.rejects(
          as(5, `update projects set version=50 where id='${p}'`),
        );
      },
    );
  } finally {
    await db.close();
  }
});

test("Optional RLS helper migration revokes execution when function exists", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create function public.rls_auto_enable() returns void language sql as $$ select $$; grant execute on function public.rls_auto_enable() to anon,authenticated;",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261012090616_restrict_rls_helper_execution.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const { rows } = await db.query(
      "select has_function_privilege('anon','public.rls_auto_enable()','execute') as anon,has_function_privilege('authenticated','public.rls_auto_enable()','execute') as authenticated",
    );
    assert.deepEqual(rows[0], { anon: false, authenticated: false });
  } finally {
    await db.close();
  }
});
