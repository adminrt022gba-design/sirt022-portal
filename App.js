/* =========================================================
   SIRT 022 PORTAL WARGA
   app.js - versi siap Vercel
   ========================================================= */

(() => {
  "use strict";

  const URL = window.SUPABASE_URL;
  const KEY = window.SUPABASE_PUBLISHABLE_KEY;

  let sb = null;
  let currentUser = null;
  let currentProfile = null;
  let residents = [];
  let wilayah = [];

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));

  function message(id, text) {
    const el = $(id);
    if (el) el.textContent = text || "";
  }
   /* ---------- NAVIGASI LAYAR ---------- */
  window.showScreen = function(id) {
    document.querySelectorAll(".screen, .app-screen").forEach(screen => {
      screen.classList.add("hidden");
      screen.setAttribute("aria-hidden", "true");
    });

    const target = $(id);
    if (!target) {
      console.warn("Layar tidak ditemukan:", id);
      return;
    }

    target.classList.remove("hidden");
    target.setAttribute("aria-hidden", "false");
    window.scrollTo({ top: 0, behavior: "instant" });

    const navIndex = {
      homeScreen: 0,
      serviceScreen: 1,
      announcementScreen: 2,
      profileScreen: 3
    };

    document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));
    if (navIndex[id] !== undefined) {
      const btn = document.querySelectorAll(".bottom-nav button")[navIndex[id]];
      if (btn) btn.classList.add("active");
    }
  };

  function initSupabase() {
    if (!window.supabase || !URL || !KEY) {
      console.error("Supabase belum tersedia. Periksa config.js.");
      return false;
    }
    sb = window.supabase.createClient(URL, KEY);
    window.sirtSupabase = sb;
    return true;
  }

  async function getSessionProfile() {
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    currentUser = user || null;

    if (!user) {
      currentProfile = null;
      return;
    }

    const result = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    currentProfile = result.data || {
      id: user.id,
      role: "warga"
    };
  }

  function updateProfileUI() {
    const p = currentProfile;

    if ($("profileName")) $("profileName").textContent = p?.nama || "Belum Login";
    if ($("profileRole")) $("profileRole").textContent = p?.role || "Warga";
    if ($("dashboardRole")) $("dashboardRole").textContent = p?.role || "Pengurus";
    if ($("dashboardTitle")) {
      $("dashboardTitle").textContent =
        p?.role === "admin" ? "Dashboard Admin" : "Dashboard Pengurus";
    }
    if ($("dashboardUser")) {
      $("dashboardUser").textContent =
        "Login sebagai: " + (p?.nama || p?.user_id || "");
    }

    document.querySelectorAll(".admin-only").forEach(el => {
      el.style.display = p?.role === "admin" ? "" : "none";
    });
  }

  /* ---------- LOGIN ---------- */
  window.login = async function() {
    if (!sb) return;

    const loginValue = $("email")?.value.trim();
    const password = $("password")?.value || "";

    if (!loginValue || !password) {
      message("loginMsg", "User ID/email dan password wajib diisi.");
      return;
    }

    message("loginMsg", "Memproses login...");

    // Supabase Auth menggunakan email untuk signInWithPassword.
    // Jika User ID digunakan, kita coba cari email melalui profile.
    let email = loginValue;

    if (!loginValue.includes("@")) {
      const { data, error } = await sb
        .from("profiles")
        .select("id")
        .eq("user_id", loginValue)
        .maybeSingle();

      if (!error && data?.id) {
        // Jika RPC tersedia, gunakan untuk mendapatkan email auth.
        const rpc = await sb.rpc("get_login_email", { profile_id: data.id });
        if (!rpc.error && rpc.data) email = rpc.data;
      }
    } 
   const { error } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      message("loginMsg", "Login gagal: " + error.message);
      return;
    }

    await getSessionProfile();
    updateProfileUI();
    await refreshPortal();

    if (currentProfile?.password_wajib_ganti) {
      showScreen("changePasswordScreen");
      message("changePasswordMsg", "Silakan ganti password awal Anda.");
    } else if (["admin", "rt", "humas"].includes(currentProfile?.role)) {
      showScreen("dashboardScreen");
    } else {
      showScreen("homeScreen");
    }
  };

  window.logout = async function() {
    if (sb) await sb.auth.signOut();
    currentUser = null;
    currentProfile = null;
    updateProfileUI();
    showScreen("homeScreen");
  };

  /* ---------- PASSWORD ---------- */
  window.resetPassword = async function() {
    if (!sb) return;

    const email = $("resetEmail")?.value.trim();
    if (!email) {
      message("resetMsg", "Masukkan email akun.");
      return;
    }

    message("resetMsg", "Mengirim link pemulihan...");

    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

    message(
      "resetMsg",
      error ? "Gagal: " + error.message : "Link pemulihan sudah dikirim ke email."
    );
  };

  window.changePassword = async function() {
    if (!sb) return;

    const p1 = $("newPassword")?.value || "";
    const p2 = $("confirmPassword")?.value || "";

    if (p1.length < 6) {
      message("changePasswordMsg", "Password minimal 6 karakter.");
      return;
    }

    if (p1 !== p2) {
      message("changePasswordMsg", "Konfirmasi password tidak sama.");
      return;
    }

    const { error } = await sb.auth.updateUser({ password: p1 });

    if (error) {
      message("changePasswordMsg", "Gagal: " + error.message);
      return;
    }

    if (currentUser) {
      await sb.from("profiles")
        .update({ password_wajib_ganti: false })
        .eq("id", currentUser.id);
    }

    if (currentProfile) currentProfile.password_wajib_ganti = false;

    message("changePasswordMsg", "Password berhasil diganti.");
    updateProfileUI();
    showScreen("homeScreen");
  };

  /* ---------- WILAYAH ---------- */
  async function loadWilayah() {
    if (!sb) return;

    const { data, error } = await sb
      .from("wilayah_rt022")
      .select("*")
      .eq("aktif", true)
      .order("blok")
      .order("nama_gang");

    if (error) {
      console.warn("wilayah_rt022:", error.message);
      return;
    }

    wilayah = data || [];

    const gang = $("residentGang");
    if (gang) {
      gang.innerHTML =
        '<option value="">Pilih gang</option>' +
        wilayah.map(w =>
          `<option value="${esc(w.nama_gang)}">${esc(w.nama_gang)} (${esc(w.blok)})</option>`
        ).join("");
    }

    const area = $("newUserArea");
    if (area) {
      area.innerHTML =
        '<option value="">Pilih wilayah</option>' +
        wilayah.map(w =>
          `<option value="${esc(w.kode)}">${esc(w.blok)} - ${esc(w.nama_gang)}</option>`
        ).join("");
    }
  }  
   /* ---------- PENGUMUMAN ---------- */
  async function loadAnnouncements() {
    if (!sb) return;

    const { data, error } = await sb
      .from("pengumuman")
      .select("*")
      .order("tgl", { ascending: false });

    if (error) {
      console.warn("pengumuman:", error.message);
      return;
    }

    const items = data || [];

    if ($("daftarPengumuman")) {
      $("daftarPengumuman").innerHTML = items.length
        ? items.map(x => `
            <div class="card">
              <h3>${esc(x.judul || x.title || "Pengumuman")}</h3>
              <p>${esc(x.isi || x.content || "")}</p>
              <small class="muted">${esc(x.tgl || "")}</small>
            </div>
          `).join("")
        : '<div class="card"><p class="muted">Belum ada pengumuman.</p></div>';
    }

    if ($("homeAnnouncements")) {
      $("homeAnnouncements").innerHTML = items.slice(0, 3).map(x => `
        <div class="item">
          <b>${esc(x.judul || x.title || "Pengumuman")}</b>
          <span>${esc(x.isi || x.content || "")}</span>
        </div>
      `).join("") || '<p class="muted">Belum ada pengumuman.</p>';
    }
  }

  /* ---------- KEGIATAN ---------- */
  async function loadActivities() {
    if (!sb) return;

    const { data, error } = await sb
      .from("kegiatan")
      .select("*");

    if (error) {
      console.warn("kegiatan:", error.message);
      return;
    }

    const items = data || [];

    if ($("daftarKegiatan")) {
      $("daftarKegiatan").innerHTML = items.length
        ? items.map(x => `
            <div class="card">
              <h3>${esc(x.namaKeg || x.nama || x.title || "Kegiatan")}</h3>
              <p>${esc(x.ketKeg || x.keterangan || "")}</p>
              <small class="muted">
                ${esc(x.tglKeg || x.tanggal || "")}
                ${esc(x.lokasi || "")}
              </small>
            </div>
          `).join("")
        : '<div class="card"><p class="muted">Belum ada kegiatan.</p></div>';
    }
  }
  /* ---------- KEGIATAN ---------- */
  async function loadActivities() {
    if (!sb) return;

    const { data, error } = await sb
      .from("kegiatan")
      .select("*");

    if (error) {
      console.warn("kegiatan:", error.message);
      return;
    }

    const items = data || [];

    if ($("daftarKegiatan")) {
      $("daftarKegiatan").innerHTML = items.length
        ? items.map(x => `
            <div class="card">
              <h3>${esc(x.namaKeg || x.nama || x.title || "Kegiatan")}</h3>
              <p>${esc(x.ketKeg || x.keterangan || "")}</p>
              <small class="muted">
                ${esc(x.tglKeg || x.tanggal || "")}
                ${esc(x.lokasi || "")}
              </small>
            </div>
          `).join("")
        : '<div class="card"><p class="muted">Belum ada kegiatan.</p></div>';
    }
  }

  /* ---------- DATA WARGA ---------- */
  async function loadResidents() {
    if (!sb) return;

    const { data, error } = await sb
      .from("warga")
      .select("*")
      .order("nama", { ascending: true });

    if (error) {
      console.warn("warga:", error.message);
      return;
    }

    residents = data || [];
    renderResidents(residents);

    if ($("jumlahWarga")) $("jumlahWarga").textContent = residents.length;

    const houses = new Set(
      residents.map(r => `${r.blok || ""}-${r.nomor_rumah || r.house || ""}`)
    );

    if ($("jumlahKK")) $("jumlahKK").textContent = houses.size || 0;
  }

  function renderResidents(list) {
    const body = $("wargaRows");
    if (!body) return;

    body.innerHTML = list.length
      ? list.map(r => `
          <tr>
            <td>${esc(r.nama || r.name)}</td>
            <td>${esc(r.jenis_kelamin || r.gender || "")}</td>
            <td>${esc(r.gang || r.nama_gang || "")}</td>
            <td>${esc(r.nomor_rumah || r.house || "")}</td>
            <td>${esc(r.status_warga || r.status || "")}</td>
            <td>
              <button class="btn secondary" onclick="editResident('${esc(r.id)}')">
                Edit
              </button>
            </td>
          </tr>
        `).join("")
      : '<tr><td colspan="6">Belum ada data.</td></tr>';
  }

  window.filterResidents = function() {
    const q = ($("residentSearch")?.value || "").toLowerCase();
    renderResidents(
      residents.filter(r => JSON.stringify(r).toLowerCase().includes(q))
    );
  };

  window.openResidentForm = function() {
    ["residentId","residentName","residentBirthDate","residentPhone",
     "residentAddress","residentHouse"].forEach(id => {
      if ($(id)) $(id).value = "";
    });

    if ($("residentFormTitle")) $("residentFormTitle").textContent = "Tambah Warga";
    showScreen("residentFormScreen");
  };

  window.editResident = function(id) {
    const r = residents.find(x => String(x.id) === String(id));
    if (!r) return;

    $("residentId").value = r.id || "";
    $("residentName").value = r.nama || r.name || "";
    $("residentGender").value = r.jenis_kelamin || r.gender || "";
    $("residentBirthDate").value = r.tanggal_lahir || r.birth_date || "";
    $("residentPhone").value = r.no_hp || r.phone || "";
    $("residentAddress").value = r.alamat || r.address || "";
    $("residentBlock").value = r.blok || "G";
    $("residentGang").value = r.gang || r.nama_gang || "";
    $("residentHouse").value = r.nomor_rumah || r.house || "";
    $("residentHousing").value = r.status_hunian || "Pemilik";
    $("residentStatus").value = r.status_warga || "Warga tetap";

    if ($("residentFormTitle")) $("residentFormTitle").textContent = "Edit Warga";
    showScreen("residentFormScreen");
  };

  window.saveResident = async function() {
    if (!sb) return;

    const id = $("residentId")?.value;

    const payload = {
      nama: $("residentName")?.value.trim(),
      jenis_kelamin: $("residentGender")?.value,
      tanggal_lahir: $("residentBirthDate")?.value || null,
      no_hp: $("residentPhone")?.value.trim(),
      alamat: $("residentAddress")?.value.trim(),
      blok: $("residentBlock")?.value,
      gang: $("residentGang")?.value,
      nomor_rumah: $("residentHouse")?.value.trim(),
      status_hunian: $("residentHousing")?.value,
      status_warga: $("residentStatus")?.value
    };

    if (!payload.nama) {
      message("residentMsg", "Nama wajib diisi.");
      return;
    }

    const result = id
      ? await sb.from("warga").update(payload).eq("id", id)
      : await sb.from("warga").insert(payload);

    if (result.error) {
      message("residentMsg", "Gagal: " + result.error.message);
      return;
    }

    message("residentMsg", "Data warga berhasil disimpan.");
    await loadResidents();
    showScreen("residentScreen");
  };

  /* ---------- LAPORAN ---------- */
  window.submitReport = async function() {
    if (!sb) return;

    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
      message("reportMsg", "Silakan login terlebih dahulu.");
      return;
    }

    const payload = {
      judul: $("reportTitle")?.value.trim(),
      kategori: $("reportCategory")?.value,
      isi: $("reportContent")?.value.trim(),
      user_id: user.id,
      created_at: new Date().toISOString()
    };

    const { error } = await sb.from("laporan_warga").insert(payload);

    if (error) {
      message("reportMsg", "Gagal: " + error.message);
      return;
    }

    message("reportMsg", "Laporan berhasil dikirim.");
    $("reportTitle").value = "";
    $("reportContent").value = "";
    await loadMyReports();
  };
    
  async function loadMyReports() {
    if (!sb || !$("myReports")) return;

    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
      $("myReports").innerHTML =
        '<p class="muted">Silakan login untuk melihat riwayat.</p>';
      return;
    }

    const { data, error } = await sb
      .from("laporan_warga")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      $("myReports").innerHTML =
        `<p class="muted">${esc(error.message)}</p>`;
      return;
    }

    $("myReports").innerHTML = data?.length
      ? data.map(x => `
          <div class="item">
            <b>${esc(x.judul)}</b>
            <span>${esc(x.isi)}</span>
            <small>${esc(x.status || "Terkirim")}</small>
          </div>
        `).join("")
      : '<p class="muted">Belum ada laporan.</p>';
  }

  /* ---------- PENGUMUMAN ADMIN ---------- */
  window.addAnnouncement = async function() {
    if (!sb) return;

    const payload = {
      judul: $("judul")?.value.trim(),
      isi: $("isi")?.value.trim(),
      tgl: $("tgl")?.value || null
    };

    if (!payload.judul || !payload.isi) {
      message("announcementMsg", "Judul dan isi wajib diisi.");
      return;
    }

    const { error } = await sb.from("pengumuman").insert(payload);

    if (error) {
      message("announcementMsg", "Gagal: " + error.message);
      return;
    }

    message("announcementMsg", "Pengumuman tersimpan.");
    $("judul").value = "";
    $("isi").value = "";
    $("tgl").value = "";
    await loadAnnouncements();
  };

  /* ---------- KEGIATAN ADMIN ---------- */
  window.addActivity = async function() {
    if (!sb) return;

    const payload = {
      namaKeg: $("namaKeg")?.value.trim(),
      tglKeg: $("tglKeg")?.value || null,
      lokasi: $("lokasi")?.value.trim(),
      ketKeg: $("ketKeg")?.value.trim()
    };

    if (!payload.namaKeg) {
      message("activityMsg", "Nama kegiatan wajib diisi.");
      return;
    }

    const { error } = await sb.from("kegiatan").insert(payload);

    if (error) {
      message("activityMsg", "Gagal: " + error.message);
      return;
    }

    message("activityMsg", "Kegiatan tersimpan.");
    await loadActivities();
  };

  /* ---------- DATA PENGURUS ---------- */
  async function loadManagement() {
    if (!sb) return;

    const { data, error } = await sb
      .from("pengurus")
      .select("*")
      .order("urutan", { ascending: true });

    if (error) return;

    const items = data || [];

    const html = items.length
      ? items.map(x => `
          <div class="card">
            <h3>${esc(x.nama || "")}</h3>
            <p>${esc(x.jabatan || "")}</p>
            <small>
              ${esc(x.wilayah || x.area || "")}
              ${x.no_hp ? " Â· " + esc(x.no_hp) : ""}
            </small>
          </div>
        `).join("")
      : '<div class="card"><p class="muted">Belum ada data.</p></div>';

    if ($("managementList")) $("managementList").innerHTML = html;
    if ($("managementAdminList")) $("managementAdminList").innerHTML = html;
  }

  window.openManagementEditor = function() {
    showScreen("managementEditorScreen");
  };

  window.saveManagement = async function() {
    if (!sb) return;

    const payload = {
      nama: $("mgmtName")?.value.trim(),
      jabatan: $("mgmtPosition")?.value.trim(),
      wilayah: $("mgmtArea")?.value.trim(),
      no_hp: $("mgmtPhone")?.value.trim(),
      urutan: Number($("mgmtOrder")?.value || 1)
    };

    if (!payload.nama) {
      message("mgmtMsg", "Nama pengurus wajib diisi.");
      return;
    }

    const { error } = await sb.from("pengurus").insert(payload);

    if (error) {
      message("mgmtMsg", "Gagal: " + error.message);
      return;
    }

    message("mgmtMsg", "Pengurus tersimpan.");
    await loadManagement();
  };

  /* ---------- AD/ART ---------- */
  async function loadAdart() {
    if (!sb || !$("adartContent")) return;

    const { data, error } = await sb
      .from("adart")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return;

    $("adartContent").innerHTML = `
      <h3>${esc(data.judul || data.title || "AD/ART")}</h3>
      <p>${esc(data.isi || data.text || "")}</p>
      ${data.file_url
        ? `<p><a href="${esc(data.file_url)}" target="_blank" rel="noopener">Buka PDF</a></p>`
        : ""}
    `;
  }

  window.openAdartEditor = function() {
    showScreen("adartEditorScreen");
  };

  window.saveAdart = async function() {
    if (!sb) return;

    const payload = {
      judul: $("adartTitle")?.value.trim(),
      isi: $("adartText")?.value.trim(),
      created_at: new Date().toISOString()
    };

    if (!payload.judul) {
      message("adartMsg", "Judul dokumen wajib diisi.");
      return;
    }

    const { error } = await sb.from("adart").insert(payload);

    if (error) {
      message("adartMsg", "Gagal: " + error.message);
      return;
    }

    message("adartMsg", "AD/ART tersimpan.");
    await loadAdart();
  };

  /* ---------- KONTAK DARURAT / PENGATURAN ---------- */
  async function loadEmergency() {
    // Tetap aman jika tabel pengaturan belum dibuat.
    const { data, error } = await sb.from("pengaturan").select("*").limit(1).maybeSingle();
    if (error || !data) return;

    const map = {
      ambulance: ["ambulanceNumber", "ambulanceCall"],
      fire: ["fireNumber", "fireCall"],
      pln: ["plnNumber", "plnCall"],
      police: ["policeNumber", "policeCall"],
      hospital: ["hospitalNumber", "hospitalCall"],
      emergency: ["emergencyNumber", "emergencyCall"]
    };

    Object.entries(map).forEach(([key, ids]) => {
      const number = data[key] || data[`set_${key}`];
      if (!number) return;

      if ($(ids[0])) $(ids[0]).textContent = number;
      if ($(ids[1])) {
        $(ids[1]).href = "tel:" + String(number).replace(/[^\d+]/g, "");
      }
    });
  }

  window.saveSettings = async function() {
    message("settingsMsg", "Pengaturan siap disimpan setelah tabel pengaturan tersedia.");
  };

  window.saveEmergencyContacts = async function() {
    message("emergencySettingsMsg", "Kontak darurat siap disimpan setelah tabel pengaturan tersedia.");
  };

  window.createUser = async function() {
    message("userMsg", "Pembuatan akun pengurus memerlukan Edge Function/Admin API Supabase. Fitur ini tidak boleh memakai service_role di browser.");
  };

  /* ---------- REFRESH ---------- */
  async function refreshPortal() {
    if (!sb) return;

    await Promise.allSettled([
      loadWilayah(),
      loadAnnouncements(),
      loadActivities(),
      loadResidents(),
      loadMyReports(),
      loadManagement(),
      loadAdart(),
      loadEmergency()
    ]);
  }

  /* ---------- START ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    // Pastikan hanya satu layar tampil sejak awal.
    showScreen("splashScreen");

    if (!initSupabase()) return;

    try {
      await getSessionProfile();
      updateProfileUI();
      await refreshPortal();
    } catch (e) {
      console.error("SIRT 022:", e);
    }

    // Splash -> home seperti desain asli.
    setTimeout(() => {
      if ($("splashScreen") && !$("splashScreen").classList.contains("hidden")) {
        showScreen("homeScreen");
      }
    }, 1200);
  });

  if (window.supabase) {
    // Listener dipasang setelah Supabase tersedia.
    setTimeout(() => {
      if (!sb) return;
      sb.auth.onAuthStateChange(async (_event, session) => {
        currentUser = session?.user || null;
        if (currentUser) {
          await getSessionProfile();
          updateProfileUI();
          await refreshPortal();
        } else {
          currentProfile = null;
          updateProfileUI();
        }
      });
    }, 0);
  }
})();
