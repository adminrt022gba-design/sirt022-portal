let sb = null;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function getSupabase() {
  if (typeof window.supabase === "undefined") return null;

  if (
    !window.SUPABASE_URL ||
    !window.SUPABASE_PUBLISHABLE_KEY
  ) return null;

  return window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );
}

async function loginAdmin() {
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const msg = document.getElementById("loginMsg");

  if (!sb) {
    if (msg) msg.textContent =
      "Supabase belum terhubung. Periksa config.js.";
    return;
  }

  const { data, error } =
    await sb.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    if (msg) msg.textContent = error.message;
    return;
  }

  document.getElementById("loginBox")?.classList.add("hidden");
  document.getElementById("adminBox")?.classList.remove("hidden");

  const who = document.getElementById("who");
  if (who) who.textContent =
    "Login: " + (data.user?.email || "");

  loadWarga();
}

async function logout() {
  if (sb) await sb.auth.signOut();

  document.getElementById("adminBox")?.classList.add("hidden");
  document.getElementById("loginBox")?.classList.remove("hidden");
}

async function loadWarga() {
  if (!sb) return;

  const { data, error } = await sb
    .from("warga")
    .select("nama,blok,no_rumah,status_warga")
    .order("nama");

  const rows = document.getElementById("wargaRows");

  if (!rows) return;

  if (error) {
    rows.innerHTML =
      "<tr><td colspan='4'>Data warga belum dapat dimuat.</td></tr>";
    return;
  }

  rows.innerHTML = (data || []).map(x => `
    <tr>
      <td>${esc(x.nama)}</td>
      <td>${esc(x.blok)}</td>
      <td>${esc(x.no_rumah)}</td>
      <td>${esc(x.status_warga)}</td>
    </tr>
  `).join("");
}

async function addAnnouncement() {
  if (!sb) return;

  const { error } = await sb
    .from("pengumuman")
    .insert({
      judul: document.getElementById("judul")?.value,
      isi: document.getElementById("isi")?.value,
      tanggal: document.getElementById("tgl")?.value || null,
      aktif: true
    });

  alert(
    error
      ? error.message
      : "Pengumuman berhasil disimpan."
  );
}

async function addActivity() {
  if (!sb) return;

  const { error } = await sb
    .from("kegiatan")
    .insert({
      nama_kegiatan:
        document.getElementById("namaKeg")?.value,
      tanggal:
        document.getElementById("tglKeg")?.value || null,
      lokasi:
        document.getElementById("lokasi")?.value,
      keterangan:
        document.getElementById("ketKeg")?.value
    });

  alert(
    error
      ? error.message
      : "Kegiatan berhasil disimpan."
  );
}

window.login = loginAdmin;
window.logout = logout;
window.addAnnouncement = addAnnouncement;
window.addActivity = addActivity;

document.addEventListener("DOMContentLoaded", async () => {
  sb = getSupabase();

  if (!sb) return;

  const { data } = await sb.auth.getSession();

  if (data?.session) {
    document.getElementById("loginBox")?.classList.add("hidden");
    document.getElementById("adminBox")?.classList.remove("hidden");

    const who = document.getElementById("who");
    if (who) who.textContent =
      "Login: " + (data.session.user?.email || "");

    loadWarga();
  }
});
