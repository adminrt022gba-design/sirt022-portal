    $("residentGang").value = r.gang || r.nama_gang || "";
    $("residentHouse").value = r.nomor_rumah || r.house || "";
    $("residentHousing").value = r.status_hunian || "Pemilik";
    $("residentStatus").value = r.status_warga || "Warga tetap";
    if ($("residentFormTitle")) $("residentFormTitle").textContent = "Edit Warga";
    showScreen("residentFormScreen");
  };

  window.saveResident = async function() {
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
    const msg = $("residentMsg");
    if (!payload.nama) { if (msg) msg.textContent = "Nama wajib diisi."; return; }
    const result = id
      ? await client.from("warga").update(payload).eq("id", id)
      : await client.from("warga").insert(payload);
    if (result.error) { if (msg) msg.textContent = "Gagal: " + result.error.message; return; }
    if (msg) msg.textContent = "Data tersimpan.";
    await loadResidents();
    showScreen("residentScreen");
  };

  window.addAnnouncement = async function() {
    const msg = $("announcementMsg");
    const payload = { judul: $("judul")?.value.trim(), isi: $("isi")?.value.trim(), tgl: $("tgl")?.value || null };
    const { error } = await client.from("pengumuman").insert(payload);
    if (error) { if (msg) msg.textContent = "Gagal: " + error.message; return; }
    if (msg) msg.textContent = "Pengumuman tersimpan.";
    $("judul").value = ""; $("isi").value = ""; $("tgl").value = "";
    await loadAnnouncements();
  };

  window.addActivity = async function() {
    const msg = $("activityMsg");
    const payload = { namaKeg: $("namaKeg")?.value.trim(), tglKeg: $("tglKeg")?.value || null, lokasi: $("lokasi")?.value.trim(), ketKeg: $("ketKeg")?.value.trim() };
    const { error } = await client.from("kegiatan").insert(payload);
    if (error) { if (msg) msg.textContent = "Gagal: " + error.message; return; }
    if (msg) msg.textContent = "Kegiatan tersimpan.";
    await loadActivities();
  };

  window.submitReport = async function() {
    const msg = $("reportMsg");
    const { data: { user } } = await client.auth.getUser();
    if (!user) { if (msg) msg.textContent = "Silakan login terlebih dahulu."; return; }
    const payload = {
      judul: $("reportTitle")?.value.trim(),
      kategori: $("reportCategory")?.value,
      isi: $("reportContent")?.value.trim(),
      user_id: user.id,
      created_at: new Date().toISOString()
    };
    const { error } = await client.from("laporan_warga").insert(payload);
    if (error) { if (msg) msg.textContent = "Gagal: " + error.message; return; }
    if (msg) msg.textContent = "Laporan berhasil dikirim.";
    await loadMyReports();
  };

  async function loadMyReports() {
    const { data: { user } } = await client.auth.getUser();
    const box = $("myReports");
    if (!box) return;
    if (!user) { box.innerHTML = '<p class="muted">Silakan login untuk melihat riwayat.</p>'; return; }
    const { data, error } = await client.from("laporan_warga").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) { box.innerHTML = `<p class="muted">${esc(error.message)}</p>`; return; }
    box.innerHTML = data?.length ? data.map(x => `<div class="item"><b>${esc(x.judul)}</b><span>${esc(x.isi)}</span><small>${esc(x.status || "Terkirim")}</small></div>`).join("") : '<p class="muted">Belum ada laporan.</p>';
  }

  async function loadEmergency() {
    // Uses a settings table only if it exists. Otherwise the HTML placeholders remain.
    const { data, error } = await client.from("pengaturan").select("*").limit(1).maybeSingle();
    if (error || !data) return;
    const map = {
      ambulance: ["ambulanceNumber","ambulanceCall"],
      fire: ["fireNumber","fireCall"],
      pln: ["plnNumber","plnCall"],
      police: ["policeNumber","policeCall"],
      hospital: ["hospitalNumber","hospitalCall"],
      emergency: ["emergencyNumber","emergencyCall"]
    };
    Object.entries(map).forEach(([key, ids]) => {
      const n = data[key] || data[`set_${key}`];
      if (n) { if ($(ids[0])) $(ids[0]).textContent = n; if ($(ids[1])) $(ids[1]).href = "tel:" + String(n).replace(/[^\d+]/g,""); }
    });
  }

  async function loadManagement() {
    const { data, error } = await client.from("pengurus").select("*").order("urutan", { ascending: true });
    if (error) return;
    const publicBox = $("managementList");
    const adminBox = $("managementAdminList");
    const html = (data || []).map(x => `<div class="card"><h3>${esc(x.nama)}</h3><p>${esc(x.jabatan || "")}</p><small>${esc(x.wilayah || x.area || "")} ${x.no_hp ? " Â· " + esc(x.no_hp) : ""}</small></div>`).join("") || '<div class="card"><p class="muted">Belum ada data.</p></div>';
    if (publicBox) publicBox.innerHTML = html;
    if (adminBox) adminBox.innerHTML = html;
  }

  async function loadAdart() {
    const { data, error } = await client.from("adart").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return;
    if ($("adartContent")) $("adartContent").innerHTML = `<h3>${esc(data.judul || data.title || "AD/ART")}</h3><p>${esc(data.isi || data.text || "")}</p>${data.file_url ? `<p><a href="${esc(data.file_url)}" target="_blank" rel="noopener">Buka PDF</a></p>` : ""}`;
  }

  async function refreshPortal() {
    await Promise.allSettled([loadWilayah(), loadAnnouncements(), loadActivities(), loadResidents(), loadEmergency(), loadManagement(), loadAdart(), loadMyReports()]);
  }

  function updateProfileUI() {
    const p = currentProfile;
    if ($("profileName")) $("profileName").textContent = p?.nama || "Belum Login";
    if ($("profileRole")) $("profileRole").textContent = p?.role || "Warga";
    if ($("dashboardRole")) $("dashboardRole").textContent = p?.role || "Pengurus";
    if ($("dashboardTitle")) $("dashboardTitle").textContent = p?.role === "admin" ? "Dashboard Admin" : "Dashboard Pengurus";
    if ($("dashboardUser")) $("dashboardUser").textContent = "Login sebagai: " + (p?.nama || p?.user_id || "");
    document.querySelectorAll(".admin-only").forEach(el => el.style.display = p?.role === "admin" ? "" : "none");
  }

  client.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await getProfile();
      updateProfileUI();
      await refreshPortal();
    } else {
      currentProfile = null;
      updateProfileUI();
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await getProfile();
      updateProfileUI();
      await refreshPortal();
    } catch (e) {
      console.error("SIRT 022 init:", e);
    }
  });
})();
