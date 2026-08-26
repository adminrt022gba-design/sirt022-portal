const data = {
 announcements: [
  ["Kerja Bakti Lingkungan","Jadwal dan informasi kerja bakti akan tampil di sini."],
  ["Pembayaran Iuran","Informasi iuran bulanan akan tampil di sini."]
 ],
 activities: [
  ["Kegiatan Warga","Jadwal kegiatan RT akan tampil di sini."],
  ["Rapat Warga RT 022","Jadwal rapat akan tampil di sini."]
 ]
};
function render(){
 document.getElementById("announcements").innerHTML=data.announcements.map(x=>`<div class="item"><b>${x[0]}</b><span>${x[1]}</span></div>`).join("");
 document.getElementById("activities").innerHTML=data.activities.map(x=>`<div class="item"><b>${x[0]}</b><span>${x[1]}</span></div>`).join("");
}
render();
document.getElementById("loginBtn").onclick=()=>alert("Login admin akan diaktifkan setelah Supabase Auth dihubungkan.");
