(() => {
  "use strict";
  const root = document.querySelector("#athar-admin"),
    $ = (s) => root.querySelector(s);
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const date = (v) => (v ? new Date(v).toLocaleString("ar-SA") : "");
  const localDate = (v) => {
    const d = new Date(v);
    return new Date(+d - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  const labels = {
    draft: "مسودة",
    scheduled: "مجدولة",
    live: "جارية",
    paused: "متوقفة",
    published: "نتائج منشورة",
    cancelled: "ملغاة",
    archived: "مؤرشفة",
    pending: "بانتظار المراجعة",
    approved: "قيد التجهيز",
    rejected: "مرفوض",
    paid: "تم التسليم",
    pendingReview: "بانتظار الاعتماد",
    active: "نشط",
    completed: "مكتمل",
  };
  const features = {
    enabled: "تشغيل التطبيق",
    storeEnabled: "المتجر",
    competitionsEnabled: "المسابقات",
    missionsEnabled: "المهام",
    boxesEnabled: "إنشاء الصناديق",
    gameEnabled: "التدريب",
  };
  let state;
  function message(value, error = false) {
    $("#athar-message").textContent = value;
    $("#athar-message").classList.toggle("error", error);
  }
  async function api(path, body) {
    const r = await fetch("/admin/athar" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": root.dataset.csrf,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 401) {
      location.assign("/admin/login");
      throw Error("سجّل الدخول مجددًا");
    }
    const data = await r.json().catch(() => {
      throw Error("وصل رد غير متوقع؛ حدّث الصفحة وتحقق من الجلسة.");
    });
    if (!r.ok) throw Error(data.message || "تعذّر إتمام الإجراء");
    return data;
  }
  function values(form) {
    const out = Object.fromEntries(new FormData(form));
    form
      .querySelectorAll("[type=checkbox]")
      .forEach((x) => (out[x.name] = x.checked));
    form
      .querySelectorAll("[type=number]")
      .forEach((x) => (out[x.name] = Number(x.value)));
    form
      .querySelectorAll("[type=datetime-local]")
      .forEach(
        (x) => (out[x.name] = x.value ? new Date(x.value).toISOString() : ""),
      );
    return out;
  }
  function fill(form, data) {
    for (const [k, v] of Object.entries(data)) {
      const x = form.elements.namedItem(k);
      if (!x) continue;
      if (x.type === "checkbox") x.checked = !!v;
      else if (x.type === "datetime-local") x.value = localDate(v);
      else x.value = v ?? "";
    }
  }
  function empty(html) {
    return html || '<p class="athar-empty">لا توجد عناصر حتى الآن</p>';
  }
  function actions(id, items, type) {
    return `<div class="athar-actions">${items.map(([act, label]) => `<button type="button" data-${type}="${esc(act)}" data-id="${esc(id)}">${esc(label)}</button>`).join("")}</div>`;
  }
  async function load() {
    state = await api("/data");
    render();
  }
  function render() {
    $("#app-state").textContent = state.config.enabled
      ? "التطبيق مفعّل"
      : "التطبيق قيد التجهيز";
    $("#overview-stats").innerHTML = [
      ["منتج متاح", state.products.filter((p) => p.active).length],
      [
        "طلب بانتظار المراجعة",
        state.orders.filter((o) => o.status === "pending").length,
      ],
      ["مسابقة", state.competitions.length],
      [
        "طلب صندوق جديد",
        state.boxes.filter((b) => b.state === "pendingReview").length,
      ],
    ]
      .map(
        ([label, n]) =>
          `<article class="athar-card"><strong>${n.toLocaleString("ar-SA")}</strong><span>${label}</span></article>`,
      )
      .join("");
    $("#feature-toggles").innerHTML = Object.entries(features)
      .map(
        ([key, label]) =>
          `<label class="check"><input type="checkbox" name="${key}">${label}</label>`,
      )
      .join("");
    fill($("#settings-form"), state.config);
    $("#product-list").innerHTML = empty(
      state.products
        .map(
          (p) =>
            `<article class="athar-card"><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><p>${(p.pointCost || { bronze: 1000, silver: 3000, gold: 5000, diamond: 10000 }[p.tier]).toLocaleString("ar-SA")} نقطة · المتاح ${p.availableStock} من ${p.stock}</p><span class="athar-badge">${p.active ? "ظاهر" : "مخفي"}</span>${actions(p.key, [["edit", "تعديل المنتج"]], "product")}</article>`,
        )
        .join(""),
    );
    $("#order-list").innerHTML = empty(
      state.orders
        .map(
          (o) =>
            `<div class="athar-row"><h3>${esc(o.prizeName || o.tier)} — ${esc(o.ambassador?.name || "حساب محذوف")}</h3><p>${esc(labels[o.status])} · ${o.amount} نقطة · ${date(o.createdAt)}</p><p>${esc(o.ambassador?.phone)} — ${esc(o.shippingAddress || "بدون عنوان مسجل")}</p>${o.note ? `<p>${esc(o.note)}</p>` : ""}${actions(
              o._id,
              o.status === "pending"
                ? [
                    ["approved", "اعتماد"],
                    ["rejected", "رفض وإرجاع النقاط"],
                  ]
                : o.status === "approved"
                  ? [
                      ["paid", "تأكيد التسليم"],
                      ["rejected", "رفض وإرجاع النقاط"],
                    ]
                  : [],
              "order",
            )}</div>`,
        )
        .join(""),
    );
    $("#competition-list").innerHTML = empty(
      state.competitions
        .map(
          (c) =>
            `<article class="athar-card"><span class="athar-badge">${esc(labels[c.state])}</span><h2>${esc(c.title)}</h2><p>${date(c.scheduledAt)}</p><p>${c.questions.length} سؤال · ${c.rewardPool.toLocaleString("ar-SA")} نقطة · ${c.durationSeconds} ثانية للسؤال</p>${actions(
              c._id,
              [
                ...(c.state === "draft"
                  ? [
                      ["edit", "تعديل الأسئلة"],
                      ["schedule", "جدولة"],
                    ]
                  : []),
                ...(c.state === "scheduled" ? [["start", "بدء المسابقة"]] : []),
                ...(c.state === "live"
                  ? [
                      ["pause", "إيقاف مؤقت"],
                      ["publish", "نشر النتائج"],
                    ]
                  : []),
                ...(c.state === "paused" ? [["resume", "استئناف"]] : []),
                ...(!["cancelled", "published", "archived"].includes(c.state)
                  ? [["cancel", "إلغاء"]]
                  : []),
                ["preview", "معاينة الترتيب والتوزيع"],
              ],
              "competition",
            )}</article>`,
        )
        .join(""),
    );
    $("#mission-list").innerHTML = empty(
      state.missions
        .map(
          (m) =>
            `<article class="athar-card"><h2>${esc(m.title)}</h2><p>${esc(m.detail)}</p><p>الهدف ${m.target} · ${m.seedReward} تدريب · ${m.rewardPointBonus} متجر</p><p>${date(m.startsAt)} — ${date(m.endsAt)}</p>${actions(m._id, [[m.active ? "off" : "on", m.active ? "إيقاف المهمة" : "تفعيل المهمة"]], "mission")}</article>`,
        )
        .join(""),
    );
    $("#box-list").innerHTML = empty(
      state.boxes
        .map(
          (b) =>
            `<form class="athar-row box-form" data-id="${esc(b._id)}"><h3>${esc(b.title)}</h3><p>عن ${esc(b.deceasedName)} · السفير ${esc(b.ambassador?.name)} · ${b.target} ريال</p><div class="athar-grid"><label>الحالة<select name="state">${["pendingReview", "active", "paused", "completed"].map((s) => `<option value="${s}" ${b.state === s ? "selected" : ""}>${labels[s]}</option>`).join("")}</select></label><label>رقم الصندوق في منصة التبرع<input name="externalId" type="number" min="1" value="${esc(b.externalId)}"></label></div><label>ملاحظة<input name="note" value="${esc(b.note)}"></label><button type="submit">حفظ واعتماد الربط</button></form>`,
        )
        .join(""),
    );
    $("#audit-list").innerHTML = empty(
      state.audit
        .map(
          (a) =>
            `<div class="athar-row"><b>${esc(a.action)}</b><p>${date(a.createdAt)} · ${esc(a.reference)}</p></div>`,
        )
        .join(""),
    );
  }
  function addQuestion(q = { choices: ["", "", "", ""] }) {
    const el = document.createElement("fieldset");
    el.className = "athar-question";
    el.innerHTML = `<legend>سؤال</legend><label>نص السؤال<textarea data-q="text" required>${esc(q.text)}</textarea></label><div class="athar-grid">${[0, 1, 2, 3].map((i) => `<label>الخيار ${i + 1}<input data-choice="${i}" value="${esc(q.choices[i])}" required></label>`).join("")}</div><label>الإجابة الصحيحة<select data-q="correctIndex">${[0, 1, 2, 3].map((i) => `<option value="${i}" ${q.correctIndex === i ? "selected" : ""}>الخيار ${i + 1}</option>`).join("")}</select></label><label>الشرح<textarea data-q="explanation" required>${esc(q.explanation)}</textarea></label><label>المرجع<input data-q="reference" value="${esc(q.reference)}" required></label><label class="check"><input type="checkbox" data-q="approved" ${q.approved ? "checked" : ""}>راجع القسم التعليمي السؤال واعتمده</label><button type="button" data-remove-question class="danger">حذف السؤال</button>`;
    $("#question-editor").append(el);
  }
  function resetCompetition() {
    $("#competition-form").reset();
    $("#competition-form").elements.id.value = "";
    $("#question-editor").replaceChildren();
    addQuestion();
  }
  $("#add-question").onclick = () => addQuestion();
  $("#new-competition").onclick = resetCompetition;
  addQuestion();
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.tab) {
      root
        .querySelectorAll(".athar-panel")
        .forEach((p) => (p.hidden = p.id !== `panel-${btn.dataset.tab}`));
      root
        .querySelectorAll("[data-tab]")
        .forEach((b) => b.classList.toggle("selected", b === btn));
      return;
    }
    if (btn.hasAttribute("data-remove-question")) {
      btn.closest("fieldset").remove();
      return;
    }
    const id = btn.dataset.id;
    if (!id) return;
    btn.disabled = true;
    try {
      if (btn.dataset.product) {
        const p = state.products.find((p) => p.key === id);
        fill($("#product-form"), {
          ...p,
          pointCost:
            p.pointCost ||
            { bronze: 1000, silver: 3000, gold: 5000, diamond: 10000 }[p.tier],
        });
        $("#product-form").scrollIntoView({ behavior: "smooth" });
        return;
      }
      if (btn.dataset.order) {
        const note = prompt("ملاحظة الطلب (اختياري):", "");
        if (note === null) return;
        await api("/orders/" + id, { status: btn.dataset.order, note });
      }
      if (btn.dataset.mission)
        await api("/missions/" + id + "/toggle", {
          active: btn.dataset.mission === "on",
        });
      if (btn.dataset.competition) {
        const act = btn.dataset.competition,
          c = state.competitions.find((c) => c._id === id);
        if (act === "edit") {
          fill($("#competition-form"), { ...c, id: c._id });
          $("#question-editor").replaceChildren();
          c.questions.forEach(addQuestion);
          $("#competition-form").scrollIntoView({ behavior: "smooth" });
          return;
        }
        if (act === "preview") {
          const data = await api("/competitions/" + id + "/results");
          const panel = $("#result-preview");
          panel.hidden = false;
          panel.innerHTML = `<h2>معاينة النتائج</h2><p>حالة الجولة: ${esc(data.state)} · الموزّع ${data.results.reduce((s, r) => s + r.points, 0)} من ${data.rewardPool}</p><div class="athar-table-wrap"><table><thead><tr><th>المركز</th><th>السفير</th><th>الدرجة</th><th>النقاط</th></tr></thead><tbody>${data.results.map((r) => `<tr><td>${r.rank}</td><td>${esc(r.name)}</td><td>${r.score}</td><td>${r.points}</td></tr>`).join("")}</tbody></table></div>`;
          panel.scrollIntoView({ behavior: "smooth" });
          return;
        }
        if (
          ["cancel", "publish", "start"].includes(act) &&
          !confirm("تأكيد الإجراء: " + btn.textContent + "؟")
        )
          return;
        await api("/competitions/" + id + "/action", { action: act });
      }
      await load();
      message("تم حفظ التغيير");
    } catch (e) {
      message(e.message, true);
    } finally {
      btn.disabled = false;
    }
  });
  root.addEventListener("submit", async (e) => {
    const form = e.target;
    if (!form.matches("form")) return;
    e.preventDefault();
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      let data = values(form),
        path;
      if (form.getAttribute("id") === "settings-form") path = "/settings";
      if (form.getAttribute("id") === "product-form") path = "/products";
      if (form.getAttribute("id") === "mission-form") path = "/missions";
      if (form.matches(".box-form")) path = "/boxes/" + form.dataset.id;
      if (form.getAttribute("id") === "competition-form") {
        path = "/competitions";
        data.questions = [...form.querySelectorAll(".athar-question")].map(
          (el) => ({
            text: el.querySelector("[data-q=text]").value,
            choices: [...el.querySelectorAll("[data-choice]")].map(
              (x) => x.value,
            ),
            correctIndex: Number(
              el.querySelector("[data-q=correctIndex]").value,
            ),
            explanation: el.querySelector("[data-q=explanation]").value,
            reference: el.querySelector("[data-q=reference]").value,
            approved: el.querySelector("[data-q=approved]").checked,
          }),
        );
      }
      await api(path, data);
      if (form.getAttribute("id") === "mission-form") form.reset();
      if (form.getAttribute("id") === "competition-form") resetCompetition();
      await load();
      message("تم الحفظ بنجاح");
    } catch (err) {
      message(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });
  load().catch((e) => message(e.message, true));
})();
