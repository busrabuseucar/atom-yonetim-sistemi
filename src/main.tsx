import { useEffect, useRef, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import "./style.css";
type Membership = {
  organization_id: string;
  role: "admin" | "research" | "officer" | "viewer";
  organizations: { name: string } | null;
};
type Project = {
  id: string;
  created_by: string;
  organization_id: string;
  title: string;
  summary: string;
  benefit: string;
  status: "submitted" | "revision" | "active";
  feedback: string;
  created_at: string;
  version: number;
};
const statuses = {
  submitted: "Değerlendirmede",
  revision: "Revizyon istendi",
  active: "Çalışılıyor",
};
const roles = {
  admin: "Yönetici",
  research: "Ar-Ge sorumlusu",
  officer: "Birim sorumlusu",
  viewer: "Görüntüleme yetkisi",
};
function App() {
  const [session, setSession] = useState<Session | null>(null),
    [starting, setStarting] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [members, setMembers] = useState<Membership[]>([]),
    [org, setOrg] = useState(""),
    [projects, setProjects] = useState<Project[]>([]),
    [selected, setSelected] = useState<Project | null>(null),
    [newForm, setNewForm] = useState(false),
    [notice, setNotice] = useState("");
  const generation = useRef(0);
  const activeUser = useRef<string | null>(null);
  const mutationBusy = useRef(false);
  const scope = useRef(0);
  const membership = members.find((m) => m.organization_id === org);
  const canCreate =
    membership && ["admin", "officer"].includes(membership.role);
  const canReview =
    membership && ["admin", "research"].includes(membership.role);
  useEffect(() => {
    if (!supabase) {
      setStarting(false);
      return;
    }
    let mounted = true;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      if (activeUser.current !== (next?.user.id ?? null)) {
        generation.current++;
        scope.current++;
        setSelected(null);
        setProjects([]);
        setMembers([]);
        setOrg("");
        setNewForm(false);
        setError("");
        setNotice("");
      }
      activeUser.current = next?.user.id ?? null;
      setSession(next);
      setStarting(false);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!session || !supabase) return;
    let alive = true;
    supabase
      .from("memberships")
      .select("organization_id,role,organizations(name)")
      .eq("user_id", session.user.id)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setError(
            "Yetki bilgileri alınamadı. Veritabanı kurulumu ve bağlantıyı kontrol et.",
          );
          return;
        }
        const items = (data ?? []) as unknown as Membership[];
        setMembers(items);
        setOrg((previous) =>
          items.some((m) => m.organization_id === previous)
            ? previous
            : (items[0]?.organization_id ?? ""),
        );
      });
    return () => {
      alive = false;
    };
  }, [session?.user.id, session?.access_token]);
  async function reload(orgId = org) {
    if (!supabase || !orgId) return;
    const tick = ++generation.current;
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (tick !== generation.current) return;
    if (error) {
      setProjects([]);
      setError("Projeler alınamadı. Erişim ve bağlantıyı kontrol et.");
    } else setProjects((data ?? []) as Project[]);
  }
  useEffect(() => {
    scope.current++;
    setNewForm(false);
    setSelected(null);
    setProjects([]);
    setError("");
    setNotice("");
    if (org) void reload(org);
    return () => {
      generation.current++;
    };
  }, [org]);
  async function run(job: () => Promise<void>) {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    const startedScope = scope.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await job();
    } catch (e) {
      if (startedScope === scope.current)
        setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      mutationBusy.current = false;
      setBusy(false);
    }
  }
  function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      const { error } = await supabase!.auth.signInWithPassword({
        email: String(f.get("email")).trim(),
        password: String(f.get("password")),
      });
      if (error)
        throw Error("Giriş yapılamadı. E-posta ve şifreni kontrol et.");
    });
  }
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session || !canCreate) return;
    const f = new FormData(e.currentTarget);
    const startedScope = scope.current;
    void run(async () => {
      const title = String(f.get("title")).trim(),
        summary = String(f.get("summary")).trim(),
        benefit = String(f.get("benefit")).trim();
      if (!title || !summary || !benefit) throw Error("Tüm alanları doldur.");
      const { error } = await supabase!
        .from("projects")
        .insert({
          organization_id: org,
          created_by: session.user.id,
          title,
          summary,
          benefit,
        });
      if (error)
        throw Error(
          "Proje kaydedilemedi. Bağlantı veya yetki değişmiş olabilir.",
        );
      if (startedScope !== scope.current) return;
      setNewForm(false);
      setNotice("Proje veritabanına kaydedildi.");
      await reload();
    });
  }
  function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || !canReview) return;
    const startedScope = scope.current;
    const f = new FormData(e.currentTarget);
    void run(async () => {
      const note = String(f.get("feedback")).trim();
      if (!note) throw Error("Değerlendirme gerekçesi zorunlu.");
      const { data, error } = await supabase!
        .from("projects")
        .update({ status: f.get("status"), feedback: note })
        .eq("id", selected.id)
        .eq("version", selected.version)
        .select("id");
      if (error)
        throw Error(
          "Değerlendirme kaydedilemedi. Yetki ve proje aşamasını kontrol et.",
        );
      if (!data?.length)
        throw Error("Kayıt değişmiş veya erişim kaldırılmış. Listeyi yenile.");
      if (startedScope !== scope.current) return;
      setSelected(null);
      setNotice("Değerlendirme kaydedildi.");
      await reload();
    });
  }
  const canRevise =
    selected?.status === "revision" &&
    (membership?.role === "admin" ||
      (membership?.role === "officer" &&
        selected.created_by === session?.user.id));
  function resubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || !canRevise) return;
    const original = selected;
    const startedScope = scope.current;
    const f = new FormData(e.currentTarget);
    void run(async () => {
      const title = String(f.get("title")).trim(),
        summary = String(f.get("summary")).trim(),
        benefit = String(f.get("benefit")).trim();
      if (!title || !summary || !benefit) throw Error("Tüm alanları doldur.");
      if (
        title === original.title &&
        summary === original.summary &&
        benefit === original.benefit
      )
        throw Error("Yeniden göndermeden önce öneriyi düzenle.");
      const { data, error } = await supabase!
        .from("projects")
        .update({ title, summary, benefit, status: "submitted" })
        .eq("id", original.id)
        .eq("version", original.version)
        .select("id");
      if (error)
        throw Error(
          "Revizyon kaydedilemedi. Yetki ve proje aşamasını kontrol et.",
        );
      if (!data?.length)
        throw Error("Kayıt değişmiş veya erişim kaldırılmış. Listeyi yenile.");
      if (startedScope !== scope.current) return;
      setSelected(null);
      setNotice("Revizyon yeniden değerlendirmeye gönderildi.");
      await reload();
    });
  }
  async function logout() {
    await run(async () => {
      const { error } = await supabase!.auth.signOut();
      if (error) throw Error("Çıkış yapılamadı. Yeniden dene.");
      setSession(null);
      setMembers([]);
      setProjects([]);
    });
  }
  const banner = (
    <>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="notice">
          {notice}
        </div>
      )}
    </>
  );
  if (!supabase)
    return (
      <main className="gate">
        <small>GENÇ İHH · ATOM</small>
        <h1>Bağlantı yapılandırması bekleniyor</h1>
        <p>Gerçek veritabanı bağlantısı kurulmadan sisteme giriş yapılamaz.</p>
        <p>
          Kurulum sorumlusu, .env.local dosyasındaki Supabase adresini ve
          publishable anahtarını tanımlamalıdır.
        </p>
      </main>
    );
  if (starting)
    return (
      <main className="gate" role="status">
        Oturum kontrol ediliyor…
      </main>
    );
  if (!session)
    return (
      <main className="gate">
        <small>GENÇ İHH · ATOM</small>
        <h1>Birim Yönetim Sistemi</h1>
        <p>Yetkili kullanıcı girişi</p>
        {banner}
        <form onSubmit={login}>
          <label>
            E-posta
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Şifre
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? "Giriş yapılıyor…" : "Giriş yap"}
          </button>
        </form>
        <p className="muted">
          Hesap ve erişim yetkileri sistem sorumlusu tarafından tanımlanır.
        </p>
      </main>
    );
  return (
    <div className="layout">
      <aside>
        <small>GENÇ İHH</small>
        <h1>ATOM</h1>
        <p>Birim Yönetim Sistemi</p>
        <hr />
        <strong>Proje Yönetimi</strong>
        <p className="muted">Araştırma · Değerlendirme · Takip</p>
      </aside>
      <main>
        <header>
          <div>
            <small>KURUMSAL ÇALIŞMA ALANI</small>
            <h1>Proje Yönetimi</h1>
          </div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void logout()}
          >
            Çıkış yap
          </button>
        </header>
        {banner}
        <section className="account">
          <span>{session.user.email}</span>
          <span>
            {membership ? roles[membership.role] : "Yetki bekleniyor"}
          </span>
          {members.length > 1 && (
            <label>
              Çalışma alanı
              <select
                disabled={busy}
                value={org}
                onChange={(e) => setOrg(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.organization_id} value={m.organization_id}>
                    {m.organizations?.name ?? m.organization_id}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
        {!membership ? (
          <section className="card">
            <h2>Çalışma alanı yetkisi bulunmuyor</h2>
            <p>
              Hesabınla giriş yapıldı. Kurum verilerine erişmek için sistem
              sorumlusunun çalışma alanı ve rol ataması yapması gerekiyor.
            </p>
          </section>
        ) : (
          <>
            <div className="toolbar">
              <h2>{membership.organizations?.name ?? "Çalışma alanı"}</h2>
              <div>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setSelected(null);
                    void reload();
                  }}
                >
                  Listeyi yenile
                </button>
                {canCreate && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      setNewForm(!newForm);
                      setSelected(null);
                    }}
                  >
                    Yeni proje
                  </button>
                )}
              </div>
            </div>
            {newForm && canCreate && (
              <section className="card">
                <h2>Proje önerisi</h2>
                <form onSubmit={create}>
                  <label>
                    Proje adı
                    <input name="title" maxLength={150} required />
                  </label>
                  <label>
                    Sorun ve yöntem
                    <textarea name="summary" maxLength={5000} required />
                  </label>
                  <label>
                    Hedef kitle ve beklenen fayda
                    <textarea name="benefit" maxLength={3000} required />
                  </label>
                  <button disabled={busy}>Değerlendirmeye gönder</button>
                </form>
              </section>
            )}
            <p className="muted">
              En yeni 200 kayıt listelenir. Sayılar yalnızca listelenen
              projelere aittir.
            </p>
            <div className="stats">
              <section>
                <b>{projects.length}</b>Listelenen proje
              </section>
              <section>
                <b>{projects.filter((p) => p.status === "submitted").length}</b>
                Değerlendirmede
              </section>
              <section>
                <b>{projects.filter((p) => p.status === "active").length}</b>
                Çalışılıyor
              </section>
            </div>
            <section className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Proje</th>
                      <th>Aşama</th>
                      <th>Kayıt tarihi</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id}>
                        <td>{p.title}</td>
                        <td>
                          <span className="tag">{statuses[p.status]}</span>
                        </td>
                        <td>
                          {new Date(p.created_at).toLocaleDateString("tr-TR")}
                        </td>
                        <td>
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => {
                              setSelected(p);
                              setNewForm(false);
                            }}
                          >
                            İncele
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!projects.length && (
                <p>Bu çalışma alanında görüntülenebilen proje kaydı yok.</p>
              )}
            </section>
            {selected && (
              <section className="card">
                <h2>{selected.title}</h2>
                <h3>Sorun ve yöntem</h3>
                <p className="text">{selected.summary}</p>
                <h3>Beklenen fayda</h3>
                <p className="text">{selected.benefit}</p>
                {selected.feedback && (
                  <p className="notice text">{selected.feedback}</p>
                )}
                {canRevise && (
                  <form
                    key={`${selected.id}-${selected.version}`}
                    onSubmit={resubmit}
                  >
                    <h3>Revizyonu düzenle</h3>
                    <label>
                      Proje adı
                      <input
                        name="title"
                        defaultValue={selected.title}
                        maxLength={150}
                        required
                      />
                    </label>
                    <label>
                      Sorun ve yöntem
                      <textarea
                        name="summary"
                        defaultValue={selected.summary}
                        maxLength={5000}
                        required
                      />
                    </label>
                    <label>
                      Hedef kitle ve beklenen fayda
                      <textarea
                        name="benefit"
                        defaultValue={selected.benefit}
                        maxLength={3000}
                        required
                      />
                    </label>
                    <button disabled={busy}>Revizyonu yeniden gönder</button>
                  </form>
                )}
                {canReview && selected.status === "submitted" && (
                  <form key={selected.id} onSubmit={review}>
                    <label>
                      Değerlendirme gerekçesi
                      <textarea name="feedback" maxLength={3000} required />
                    </label>
                    <label>
                      Sonuç
                      <select name="status">
                        <option value="revision">Revizyon iste</option>
                        <option value="active">Çalışma aşamasına geçir</option>
                      </select>
                    </label>
                    <button disabled={busy}>Değerlendirmeyi kaydet</button>
                  </form>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
