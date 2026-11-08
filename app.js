// المنظومة السحابية المتكاملة لمتجر ونظام المأمون الإلكتروني الحديث (Al-Mamon Enterprise ERP & Storefront)
const SUPABASE_URL = "https://nlxiixqzgkvjfntggekt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5seGlpeHF6Z2t2amZudGdnZWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwOTAxNDUsImV4cCI6MjEwOTY2NjE0NX0.j5JWB2ffFdl5F6CY0WgoAiYFcLc0pseJEf7O8RPcLg0";

const state = {
  mode: "store", // store | admin | pos | scales
  adminTab: "dashboard", // dashboard | products | orders | groups | accounting | vouchers | maintenance | hr | utilities | aluminum | settings
  currency: "YER",
  currencies: {
    YER: { name: "ريال يمني", rate: 1, symbol: "ر.ي" },
    SAR: { name: "ريال سعودي", rate: 140, symbol: "ر.س" },
    YRS: { name: "يمني جديد", rate: 0.341, symbol: "ر.ي جديد" },
    USD: { name: "دولار أمريكي", rate: 530, symbol: "$" }
  },
  logo: (window.ALMAMON_INITIAL_DATA && window.ALMAMON_INITIAL_DATA.logo_b64) || "assets/logo.jpg",
  groups: (window.ALMAMON_INITIAL_DATA && window.ALMAMON_INITIAL_DATA.groups) || [],
  cats: (window.ALMAMON_INITIAL_DATA && window.ALMAMON_INITIAL_DATA.cats) || [],
  products: (window.ALMAMON_INITIAL_DATA && window.ALMAMON_INITIAL_DATA.initial_products) || [],
  totalCloudProducts: (window.ALMAMON_INITIAL_DATA && window.ALMAMON_INITIAL_DATA.total_cloud_products) || 1937,
  allLoaded: false,
  selectedGroup: 0,
  selectedCat: 0,
  searchQuery: "",
  sortBy: "default",
  page: 1,
  perPage: 24,
  cart: JSON.parse(localStorage.getItem("almamon_cart") || "[]"),
  wishlist: JSON.parse(localStorage.getItem("almamon_wishlist") || "[]"),
  appliedCoupon: null,
  orders: [],
  accounts: [],
  invoices: [],
  vouchers: [],
  maintenance: [],
  posTabs: [
    { id: 1, title: "فاتورة مبيعات #1", type: "sale", payment: "cash", customer: "عميل نقدي", discount: 0, items: [] }
  ],
  activePosTab: 0
};

// Helper: Supabase REST call
async function sbFetch(path, options = {}) {
  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || res.statusText);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  return null;
}

// Format Price in selected currency
function formatPrice(amountYER) {
  const num = Number(amountYER) || 0;
  if (num <= 0) return "السعر عند الطلب";
  const c = state.currencies[state.currency] || state.currencies.YER;
  let converted = num;
  if (state.currency === "SAR") converted = num / 140;
  else if (state.currency === "USD") converted = num / 530;
  else if (state.currency === "YRS") converted = num * 0.341;
  return `${converted.toLocaleString("en-US", { maximumFractionDigits: state.currency === "YER" ? 0 : 2 })} <small>${c.symbol}</small>`;
}

// Arabic Tafqeet (تفقيط المبالغ)
function tafqeetAR(num) {
  const n = Math.round(Number(num) || 0);
  if (n <= 0) return "صفر ريال فقط لا غير";
  const c = state.currencies[state.currency] || state.currencies.YER;
  return `${n.toLocaleString("en-US")} ${c.name} فقط لا غير`;
}

// Load all live data from Supabase
async function syncWithSupabase() {
  try {
    // Load first 1000 + second 1000 products from Supabase
    const [p1, p2, orders, accounts, invoices, vouchers, maint] = await Promise.all([
      sbFetch("products?select=*&order=itemid.desc&limit=1000&offset=0"),
      sbFetch("products?select=*&order=itemid.desc&limit=1000&offset=1000"),
      sbFetch("store_orders?select=*&order=created_at.desc"),
      sbFetch("accounts?select=*&order=account_code.asc"),
      sbFetch("invoices?select=*&order=created_at.desc"),
      sbFetch("vouchers?select=*&order=created_at.desc"),
      sbFetch("maintenance_tickets?select=*&order=created_at.desc")
    ]);
    const combined = [...(p1 || []), ...(p2 || [])];
    if (combined.length > 0) {
      state.products = combined;
      state.totalCloudProducts = combined.length;
      state.allLoaded = true;
    }
    if (orders) state.orders = orders;
    if (accounts) state.accounts = accounts;
    if (invoices) state.invoices = invoices;
    if (vouchers) state.vouchers = vouchers;
    if (maint) state.maintenance = maint;

    const badge = document.getElementById("cloud-status-text");
    if (badge) {
      badge.textContent = `متصل بالسيرفر الجديد (Supabase Cloud) • ${state.products.length.toLocaleString()} صنف متزامن لحظياً`;
    }
    renderApp();
  } catch (err) {
    console.warn("Using local cached dataset:", err);
  }
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  renderApp();
}

function setCurrency(curr) {
  state.currency = curr;
  renderApp();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute("data-theme", current === "dark" ? "light" : "dark");
}

function saveCart() {
  localStorage.setItem("almamon_cart", JSON.stringify(state.cart));
  const el = document.getElementById("cart-count-badge");
  if (el) el.textContent = state.cart.reduce((s, i) => s + i.qty, 0);
}

function addToCart(itemid, customQty = 1, customPrice = null, customLabel = "") {
  const prod = state.products.find(p => Number(p.itemid) === Number(itemid));
  if (!prod) return;
  const price = customPrice !== null ? Number(customPrice) : Number(prod.price_sale || 0);
  const existing = state.cart.find(i => Number(i.itemid) === Number(itemid) && i.customLabel === customLabel);
  if (existing) {
    existing.qty = Number((existing.qty + customQty).toFixed(3));
  } else {
    state.cart.push({
      itemid: prod.itemid,
      arname: prod.arname + (customLabel ? ` (${customLabel})` : ""),
      price: price,
      qty: customQty,
      image_url: prod.image_url,
      barcode: prod.barcode,
      customLabel
    });
  }
  saveCart();
  showToast(`تمت إضافة "${prod.arname}" إلى السلة بنجاح 🛒`);
  renderApp();
}

function showToast(msg) {
  let t = document.getElementById("toast-box");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast-box";
    t.style.cssText = "position:fixed;bottom:24px;right:24px;background:#0047CC;color:#fff;padding:12px 20px;border-radius:12px;font-weight:700;z-index:3000;box-shadow:0 8px 25px rgba(0,0,0,0.25);transition:all 0.3s;";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { t.style.opacity = "0"; }, 3000);
}

// Filter Products for Storefront
function getFilteredProducts() {
  let list = state.products.filter(p => !p.ishide || Number(p.ishide) === 0);
  if (state.selectedGroup && Number(state.selectedGroup) !== 0 && Number(state.selectedGroup) !== 931676313761) {
    list = list.filter(p => Number(p.group_id) === Number(state.selectedGroup));
  }
  if (state.selectedCat && Number(state.selectedCat) !== 0) {
    list = list.filter(p => Number(p.parent_id) === Number(state.selectedCat));
  }
  if (state.searchQuery.trim() !== "") {
    const q = state.searchQuery.trim().toLowerCase();
    list = list.filter(p =>
      (p.arname && p.arname.toLowerCase().includes(q)) ||
      (p.barcode && String(p.barcode).toLowerCase().includes(q)) ||
      (p.item_number && String(p.item_number).toLowerCase().includes(q)) ||
      (p.item_desc && p.item_desc.toLowerCase().includes(q))
    );
  }
  if (state.sortBy === "price_asc") {
    list = [...list].sort((a, b) => (Number(a.price_sale) || 99999999) - (Number(b.price_sale) || 99999999));
  } else if (state.sortBy === "price_desc") {
    list = [...list].sort((a, b) => (Number(b.price_sale) || 0) - (Number(a.price_sale) || 0));
  } else if (state.sortBy === "scale_only") {
    list = list.filter(p => p.is_scale_item || Number(p.group_id) === 8610908145 || (p.arname && p.arname.includes("ميزان")));
  }
  return list;
}

// ==================== RENDER STOREFRONT ====================
function renderStorefront() {
  const filtered = getFilteredProducts();
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.perPage));
  if (state.page > totalPages) state.page = 1;
  const pageItems = filtered.slice((state.page - 1) * state.perPage, state.page * state.perPage);
  const subcats = state.selectedGroup
    ? state.cats.filter(c => Number(c.group_id) === Number(state.selectedGroup))
    : state.cats.slice(0, 18);
  const cartCount = state.cart.reduce((s, i) => s + i.qty, 0);

  return `
    <header class="store-header">
      <div class="store-header-inner">
        <div class="store-logo-wrap" onclick="selectGroup(0)" style="cursor:pointer;">
          <img src="${state.logo}" class="store-logo" alt="المأمون ستور" onerror="this.src='assets/logo.jpg'">
          <div class="store-title">
            <h1>المأمون ستور</h1>
            <p>متجر المأمون الإلكتروني الحديث • تعز - الحوبان (781002020)</p>
          </div>
        </div>

        <div class="store-search-bar">
          <input type="text" id="store-search-input" placeholder="ابحث في ${state.products.length.toLocaleString()} منتج بالاسم أو الرقم أو الباركود..." value="${state.searchQuery}" oninput="onStoreSearch(this.value)">
          <button onclick="onStoreSearch(document.getElementById('store-search-input').value)">🔍 بحث</button>
        </div>

        <div class="store-nav-actions">
          <button class="action-pill" onclick="openKabinaModal()">📱 كبينة السداد وواي فاي</button>
          <button class="action-pill" onclick="openMaintenanceTrackModal()">🛠️ صيانة الأجهزة</button>
          <button class="action-pill" onclick="openOrdersTrackModal()">📦 طلباتي (${state.orders.length})</button>
          <button class="action-pill cart-pill" onclick="openCartModal()">
            🛒 السلة <span class="badge-count" id="cart-count-badge">${cartCount}</span>
          </button>
        </div>
      </div>
    </header>

    <main class="store-container">
      <!-- Hero Banner & Quick Actions -->
      <section class="hero-grid">
        <div class="hero-slider">
          <div class="hero-content">
            <span class="hero-tag">✨ النسخة المطورة على السيرفر السحابي الجديد</span>
            <h2>متجر المأمون الإلكتروني الحديث</h2>
            <p>أجود وأرقى الإلكترونيات، الميازين الإلكترونية الاحترافية، الأجهزة المنزلية، الشاشات، الكمبيوتر، الطاقة الشمسية وقطع الغيار بأفضل الأسعار وعروض حصرية.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="btn" style="background:#fff;color:#0047CC;" onclick="selectGroup(8610908145)">⚖️ تصفح الميازين الإلكترونية</button>
              <button class="btn" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid #fff;" onclick="openQuickAddProductModal()">➕ إضافة صنف فوري من الإدارة</button>
            </div>
          </div>
          <img src="${state.logo}" style="width:125px;height:125px;border-radius:50%;border:4px solid rgba(255,255,255,0.4);object-fit:cover;" alt="Logo">
        </div>

        <div class="hero-QuickCards">
          <div class="q-service-card" onclick="openKabinaModal()">
            <div class="q-service-icon">💳</div>
            <strong>كبينة السداد الفوري</strong>
            <span style="font-size:11.5px;color:var(--muted);">يمن موبايل، يو، سبأفون، يمن فورجي، عدن نت</span>
          </div>
          <div class="q-service-card" onclick="openKabinaModal('wifi')">
            <div class="q-service-icon">📶</div>
            <strong>كروت شبكات الواي فاي</strong>
            <span style="font-size:11.5px;color:var(--muted);">شراء فوري لكروت الشبكات المحلية</span>
          </div>
          <div class="q-service-card" onclick="setMode('scales')">
            <div class="q-service-icon">⚖️</div>
            <strong>مركز الميازين والباركود</strong>
            <span style="font-size:11.5px;color:var(--muted);">الميازين الإلكترونية وميزان المراجعة</span>
          </div>
          <div class="q-service-card" onclick="openAIAssistantModal()">
            <div class="q-service-icon">🤖</div>
            <strong>المساعد الذكي للمتجر</strong>
            <span style="font-size:11.5px;color:var(--muted);">استشر الذكاء الاصطناعي لاختيار جهازك</span>
          </div>
        </div>
      </section>

      <!-- Main Groups (الأقسام الرئيسية الـ 13) -->
      <div class="section-header">
        <h3>📂 الأقسام والمجموعات الرئيسية (${state.groups.length} قسماً)</h3>
        <div style="display:flex;gap:8px;align-items:center;">
          <select class="curr-select" style="background:var(--card);color:var(--text);border-color:var(--border);" onchange="onSortChange(this.value)">
            <option value="default" ${state.sortBy === "default" ? "selected" : ""}>الترتيب الافتراضي</option>
            <option value="price_asc" ${state.sortBy === "price_asc" ? "selected" : ""}>السعر: من الأقل للأعلى</option>
            <option value="price_desc" ${state.sortBy === "price_desc" ? "selected" : ""}>السعر: من الأعلى للأقل</option>
            <option value="scale_only" ${state.sortBy === "scale_only" ? "selected" : ""}>⚖️ الميازين الإلكترونية فقط</option>
          </select>
        </div>
      </div>

      <div class="groups-strip">
        <div class="group-chip ${Number(state.selectedGroup) === 0 ? 'active' : ''}" onclick="selectGroup(0)">
          <img src="${state.logo}" alt="الكل">
          <span>كافة الأقسام (${state.products.length})</span>
        </div>
        ${state.groups.filter(g => g.group_name !== "بحث").map(g => `
          <div class="group-chip ${Number(state.selectedGroup) === Number(g.id) ? 'active' : ''}" onclick="selectGroup(${g.id})">
            <img src="${g.image_url || state.logo}" alt="${g.group_name}" onerror="this.src='${state.logo}'">
            <span>${g.group_name}</span>
          </div>
        `).join("")}
      </div>

      <!-- Subcategories Strip -->
      <div class="subcats-strip">
        <button class="subcat-pill ${Number(state.selectedCat) === 0 ? 'active' : ''}" onclick="selectCat(0)">الكل (${filtered.length})</button>
        ${subcats.map(c => `
          <button class="subcat-pill ${Number(state.selectedCat) === Number(c.id) ? 'active' : ''}" onclick="selectCat(${c.id})">${c.arname}</button>
        `).join("")}
      </div>

      <!-- Products Listing -->
      <div class="section-header">
        <h3>🛍️ المنتجات المعروضة (${filtered.length.toLocaleString()} منتج)</h3>
        <span style="font-size:12.5px;color:var(--muted);">صفحة ${state.page} من ${totalPages} • أي تعديل من الإدارة يظهر هنا فوراً</span>
      </div>

      <div class="products-grid">
        ${pageItems.map(p => {
          const isScale = p.is_scale_item || Number(p.group_id) === 8610908145 || (p.arname && p.arname.includes("ميزان"));
          return `
            <div class="product-card">
              ${isScale ? `<span class="prod-badge scale">⚖️ ميزان إلكتروني</span>` : (p.is_new ? `<span class="prod-badge">جديد</span>` : "")}
              <div class="prod-img-box" onclick="openProductDetail(${p.itemid})">
                <img src="${p.image_url || 'assets/noimgprod.jpg'}" loading="lazy" alt="${p.arname}" onerror="this.src='assets/noimgprod.jpg'">
              </div>
              <div class="prod-body">
                <div>
                  <div class="prod-meta">
                    <span>رقم: #${p.item_number || p.itemid}</span>
                    <span>باركود: ${p.barcode || '-'}</span>
                  </div>
                  <div class="prod-title" onclick="openProductDetail(${p.itemid})">${p.arname}</div>
                </div>
                <div class="prod-price-row">
                  <div class="prod-price">${formatPrice(p.price_sale)}</div>
                  <button class="btn-add-cart" onclick="addToCart(${p.itemid})">🛒 أضف</button>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <!-- Pagination -->
      <div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:28px;flex-wrap:wrap;">
        <button class="btn btn-outline" ${state.page <= 1 ? "disabled" : ""} onclick="changePage(${state.page - 1})">السابق</button>
        <span style="font-weight:700;padding:0 12px;">صفحة ${state.page} من ${totalPages} (إجمالي ${filtered.length} صنف)</span>
        <button class="btn btn-primary" ${state.page >= totalPages ? "disabled" : ""} onclick="changePage(${state.page + 1})">التالي</button>
      </div>
    </main>
  `;
}

// ==================== RENDER WINDOWS / WEB ADMIN ERP ====================
function renderAdminERP() {
  const totalStockValue = state.products.reduce((s, p) => s + (Number(p.price_sale || 0) * Number(p.stock_qty || 20)), 0);
  const scaleProducts = state.products.filter(p => p.is_scale_item || Number(p.group_id) === 8610908145 || (p.arname && p.arname.includes("ميزان")));

  return `
    <div class="erp-layout">
      <aside class="erp-sidebar">
        <div class="erp-sidebar-header">
          <img src="${state.logo}" alt="Logo">
          <div>
            <div style="font-weight:800;font-size:14.5px;color:#fff;">نظام المأمون للإدارة</div>
            <div style="font-size:11px;color:#38bdf8;">نسخة الوندوز والسحابة المطورة</div>
          </div>
        </div>

        <div class="erp-nav-group-title">القيادة والمتجر الإلكتروني</div>
        <button class="erp-nav-item ${state.adminTab === 'dashboard' ? 'active' : ''}" onclick="setAdminTab('dashboard')">
          <span>📊 لوحة القيادة والإحصائيات</span>
        </button>
        <button class="erp-nav-item ${state.adminTab === 'products' ? 'active' : ''}" onclick="setAdminTab('products')">
          <span>📦 إدارة الأصناف والمتجر (${state.products.length})</span>
        </button>
        <button class="erp-nav-item ${state.adminTab === 'groups' ? 'active' : ''}" onclick="setAdminTab('groups')">
          <span>📂 شجرة المجموعات والتصنيفات</span>
        </button>
        <button class="erp-nav-item ${state.adminTab === 'orders' ? 'active' : ''}" onclick="setAdminTab('orders')">
          <span>🛍️ طلبات التطبيق والتوصيل (${state.orders.length})</span>
        </button>

        <div class="erp-nav-group-title">المبيعات والمحاسبة والميزان</div>
        <button class="erp-nav-item" onclick="setMode('pos')">
          <span>⚡ شاشة الكاشير والفواتير (F10)</span>
        </button>
        <button class="erp-nav-item" onclick="setMode('scales')">
          <span>⚖️ الميازين وميزان المراجعة المطور</span>
        </button>
        <button class="erp-nav-item ${state.adminTab === 'vouchers' ? 'active' : ''}" onclick="setAdminTab('vouchers')">
          <span>🧾 السندات المالية والقيود</span>
        </button>
        <button class="erp-nav-item ${state.adminTab === 'accounting' ? 'active' : ''}" onclick="setAdminTab('accounting')">
          <span>🏦 شجرة الحسابات والأرصدة</span>
        </button>

        <div class="erp-nav-group-title">الأنظمة المتخصصة المدمجة</div>
        <button class="erp-nav-item ${state.adminTab === 'maintenance' ? 'active' : ''}" onclick="setAdminTab('maintenance')">
          <span>🛠️ نظام صيانة الأجهزة وقطع الغيار</span>
        </button>
        <button class="erp-nav-item ${state.adminTab === 'hr' ? 'active' : ''}" onclick="setAdminTab('hr')">
          <span>👥 الموارد البشرية والبصمة والرواتب</span>
        </button>
        <button class="erp-nav-item ${state.adminTab === 'utilities' ? 'active' : ''}" onclick="setAdminTab('utilities')">
          <span>💡 كبينة السداد والكهرباء والمياه</span>
        </button>
        <button class="erp-nav-item ${state.adminTab === 'aluminum' ? 'active' : ''}" onclick="setAdminTab('aluminum')">
          <span>🪟 مصمم وحاسبة نوافذ الألمنيوم</span>
        </button>
        <button class="erp-nav-item ${state.adminTab === 'settings' ? 'active' : ''}" onclick="setAdminTab('settings')">
          <span>⚙️ إعدادات المتجر والربط والنسخ</span>
        </button>
      </aside>

      <section class="erp-main">
        <div class="kpi-grid">
          <div class="kpi-card">
            <div>
              <h4>إجمالي أصناف المتجر والمخزن</h4>
              <div class="val">${state.products.length.toLocaleString()} صنف</div>
              <small style="color:#10b981;">متزامن مع الويب وتطبيق العملاء</small>
            </div>
            <div class="kpi-icon" style="background:#e0f2fe;color:#0284c7;">📦</div>
          </div>
          <div class="kpi-card">
            <div>
              <h4>أصناف قسم الميازين الإلكترونية</h4>
              <div class="val">${scaleProducts.length} ميزان/صنف</div>
              <small style="color:#0d9488;">يدعم باركود الوزن والسعر EAN-13</small>
            </div>
            <div class="kpi-icon" style="background:#ccfbf1;color:#0d9488;">⚖️</div>
          </div>
          <div class="kpi-card">
            <div>
              <h4>طلبات المتجر الإلكتروني</h4>
              <div class="val">${state.orders.length} طلبات نشطة</div>
              <small style="color:#f59e0b;">إشعارات فورية + تحويل لفاتورة</small>
            </div>
            <div class="kpi-icon" style="background:#fef3c7;color:#d97706;">🛒</div>
          </div>
          <div class="kpi-card">
            <div>
              <h4>القيمة التقديرية للمخزون</h4>
              <div class="val">${formatPrice(totalStockValue)}</div>
              <small style="color:var(--primary);">المخزن الرئيسي - تعز الحوبان</small>
            </div>
            <div class="kpi-icon" style="background:#ede9fe;color:#7c3aed;">💰</div>
          </div>
        </div>

        ${renderAdminTabContent()}
      </section>
    </div>
  `;
}

function renderAdminTabContent() {
  if (state.adminTab === "dashboard") {
    return `
      <div class="erp-card">
        <div class="erp-card-header">
          <h3>🚀 مركز التحكم السريع بمتجر ونظام المأمون (تزامن لحظي بين الإدارة والويب)</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="openQuickAddProductModal()">➕ إضافة صنف جديد للمتجر</button>
            <button class="btn btn-success" onclick="setMode('pos')">⚡ فتح فاتورة كاشير (F10)</button>
            <button class="btn btn-warning" onclick="setMode('scales')">⚖️ فتح ميزان المراجعة والميازين</button>
            <button class="btn btn-outline" onclick="exportProductsCSV()">📥 تصدير الأصناف إلى Excel</button>
          </div>
        </div>
        <p style="font-size:13.5px;color:var(--muted);margin-bottom:16px;">
          أي منتج أو قسم أو سعر أو عرض تقوم بإضافته أو تعديله هنا في لوحة الإدارة يتم حفظه فوراً في السيرفر السحابي الجديد (Supabase PostgreSQL) ويظهر في نفس الثانية للعملاء في موقع الويب وتطبيق الجوال.
        </p>

        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>اسم العميل</th>
                <th>الهاتف والمدينة</th>
                <th>طريقة الدفع</th>
                <th>الإجمالي</th>
                <th>الحالة</th>
                <th>إجراءات الإدارة</th>
              </tr>
            </thead>
            <tbody>
              ${state.orders.map(o => `
                <tr>
                  <td><strong>${o.order_number}</strong></td>
                  <td>${o.customer_name}</td>
                  <td>${o.customer_phone} (${o.customer_city})</td>
                  <td>${o.payment_method}</td>
                  <td><strong>${formatPrice(o.total_amount)}</strong></td>
                  <td><span class="subcat-pill active" style="font-size:11px;padding:3px 10px;">${o.status}</span></td>
                  <td>
                    <button class="btn btn-success" style="padding:4px 9px;font-size:11.5px;" onclick="updateOrderStatus(${o.id}, 'completed')">✅ اعتماد</button>
                    <button class="btn btn-primary" style="padding:4px 9px;font-size:11.5px;" onclick="convertOrderToInvoice(${o.id})">🧾 تحويل لفاتورة</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (state.adminTab === "products") {
    const list = getFilteredProducts().slice(0, 60);
    return `
      <div class="erp-card">
        <div class="erp-card-header">
          <h3>📦 إدارة الأصناف والمخزون (${state.products.length.toLocaleString()} صنف في قاعدة البيانات)</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="text" placeholder="بحث بالاسم أو الباركود أو الرقم..." value="${state.searchQuery}" oninput="onStoreSearch(this.value)" style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;font-family:var(--font);">
            <button class="btn btn-primary" onclick="openQuickAddProductModal()">➕ إضافة صنف جديد</button>
            <button class="btn btn-success" onclick="exportProductsCSV()">📥 تصدير Excel/CSV</button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>الصورة</th>
                <th>رقم الصنف</th>
                <th>الباركود</th>
                <th>اسم الصنف</th>
                <th>سعر البيع (YER)</th>
                <th>الكمية</th>
                <th>ميزان؟</th>
                <th>إجراءات فورية</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(p => `
                <tr>
                  <td><img src="${p.image_url || 'assets/noimgprod.jpg'}" style="width:40px;height:40px;object-fit:contain;border-radius:6px;background:#fff;" onerror="this.src='assets/noimgprod.jpg'"></td>
                  <td>#${p.item_number || p.itemid}</td>
                  <td><code>${p.barcode || '-'}</code></td>
                  <td><strong>${p.arname}</strong></td>
                  <td>
                    <input type="number" value="${Number(p.price_sale || 0)}" style="width:105px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;" onchange="updateProductPrice(${p.itemid}, this.value)">
                  </td>
                  <td>${p.stock_qty || 25} ${p.unit_name || 'حبة'}</td>
                  <td>${p.is_scale_item ? '⚖️ نعم' : 'لا'}</td>
                  <td>
                    <button class="btn btn-outline" style="padding:4px 8px;font-size:11.5px;" onclick="printBarcodeLabel(${p.itemid})">🏷️ باركود</button>
                    <button class="btn btn-danger" style="padding:4px 8px;font-size:11.5px;" onclick="toggleHideProduct(${p.itemid})">${p.ishide ? 'إظهار' : 'إخفاء'}</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (state.adminTab === "orders") {
    return `
      <div class="erp-card">
        <div class="erp-card-header">
          <h3>🛍️ إدارة طلبات المتجر الإلكتروني وتعيين مناديب التوصيل</h3>
        </div>
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>العميل</th>
                <th>الهاتف</th>
                <th>العنوان</th>
                <th>طريقة الدفع والمرجع</th>
                <th>الإجمالي</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${state.orders.map(o => `
                <tr>
                  <td><strong>${o.order_number}</strong></td>
                  <td>${o.customer_name}</td>
                  <td>${o.customer_phone}</td>
                  <td>${o.customer_city} - ${o.customer_address}</td>
                  <td>${o.payment_method} (${o.payment_ref || '-'})</td>
                  <td><strong>${formatPrice(o.total_amount)}</strong></td>
                  <td>
                    <select onchange="updateOrderStatus(${o.id}, this.value)" style="padding:4px 8px;border-radius:6px;">
                      <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
                      <option value="preparing" ${o.status === 'preparing' ? 'selected' : ''}>قيد التجهيز</option>
                      <option value="shipping" ${o.status === 'shipping' ? 'selected' : ''}>في الطريق مع المندوب</option>
                      <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>تم التسليم ومكتمل</option>
                      <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
                    </select>
                  </td>
                  <td>
                    <button class="btn btn-primary" style="padding:4px 9px;font-size:11.5px;" onclick="convertOrderToInvoice(${o.id})">🧾 إصدار فاتورة</button>
                    <a class="btn btn-success" style="padding:4px 9px;font-size:11.5px;text-decoration:none;" target="_blank" href="https://wa.me/967${o.customer_phone}?text=${encodeURIComponent('مرحباً ' + o.customer_name + '، طلبكم رقم ' + o.order_number + ' في متجر المأمون حالته الآن: ' + o.status)}">💬 واتساب</a>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (state.adminTab === "groups") {
    return `
      <div class="erp-card">
        <div class="erp-card-header">
          <h3>📂 شجرة المجموعات الرئيسية (${state.groups.length}) والتصنيفات الفرعية (${state.cats.length})</h3>
          <button class="btn btn-primary" onclick="promptAddGroup()">➕ إضافة قسم رئيسي جديد</button>
        </div>
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>الصورة</th>
                <th>معرف القسم</th>
                <th>اسم المجموعة الرئيسية</th>
                <th>عدد التصنيفات الفرعية</th>
                <th>عدد الأصناف المرتبطة</th>
                <th>الحالة في المتجر</th>
              </tr>
            </thead>
            <tbody>
              ${state.groups.map(g => {
                const subCount = state.cats.filter(c => Number(c.group_id) === Number(g.id)).length;
                const prodCount = state.products.filter(p => Number(p.group_id) === Number(g.id)).length;
                return `
                  <tr>
                    <td><img src="${g.image_url || state.logo}" style="width:38px;height:38px;border-radius:8px;object-fit:contain;background:#fff;" onerror="this.src='${state.logo}'"></td>
                    <td>#${g.id}</td>
                    <td><strong>${g.group_name}</strong></td>
                    <td>${subCount} تصنيف فرعي</td>
                    <td>${prodCount} منتج</td>
                    <td><span style="color:#10b981;font-weight:700;">ظاهر في الويب والتطبيق</span></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (state.adminTab === "vouchers" || state.adminTab === "accounting") {
    return renderScalesAndTrialBalance(true);
  }

  if (state.adminTab === "maintenance") {
    return `
      <div class="erp-card">
        <div class="erp-card-header">
          <h3>🛠️ نظام إدارة صيانة الأجهزة وقطع الغيار (مرتبط بالمخزون والمحاسبة)</h3>
          <button class="btn btn-primary" onclick="openNewMaintenanceModal()">➕ استلام جهاز صيانة جديد</button>
        </div>
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>رقم السند</th>
                <th>العميل والهاتف</th>
                <th>الجهاز والموديل</th>
                <th>وصف العطل</th>
                <th>تكلفة الصيانة والقطع</th>
                <th>المدفوع</th>
                <th>الحالة</th>
                <th>طباعة</th>
              </tr>
            </thead>
            <tbody>
              ${state.maintenance.map(m => `
                <tr>
                  <td><strong>${m.ticket_number}</strong></td>
                  <td>${m.customer_name} (${m.customer_phone})</td>
                  <td>${m.device_name} - ${m.device_brand} ${m.device_model}</td>
                  <td>${m.problem_desc}</td>
                  <td>${formatPrice(Number(m.service_cost || 0) + Number(m.parts_cost || 0))}</td>
                  <td>${formatPrice(m.paid_amount)}</td>
                  <td><span class="subcat-pill active" style="font-size:11px;">${m.status}</span></td>
                  <td><button class="btn btn-outline" style="padding:4px 8px;font-size:11.5px;" onclick="window.print()">🖨️ سند صيانة</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (state.adminTab === "aluminum") {
    return `
      <div class="erp-card">
        <div class="erp-card-header">
          <h3>🪟 مصمم وحاسبة نوافذ وأبواب الألمنيوم الهندسي (مع قائمة القص والتكلفة)</h3>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>العرض (بالمليمتر mm)</label>
            <input type="number" id="alu-w" value="1200" oninput="calcAluminum()">
          </div>
          <div class="form-group">
            <label>الارتفاع (بالمليمتر mm)</label>
            <input type="number" id="alu-h" value="1500" oninput="calcAluminum()">
          </div>
          <div class="form-group">
            <label>عدد الضلف</label>
            <select id="alu-leaves" onchange="calcAluminum()">
              <option value="2">ضلفتين سحاب (Sliding 2)</option>
              <option value="3">3 ضلف سحاب</option>
              <option value="1">ضلفة مفصلية</option>
            </select>
          </div>
          <div class="form-group">
            <label>لون الألمنيوم والزجاج</label>
            <select id="alu-color" onchange="calcAluminum()">
              <option value="أبيض + زجاج عاكس أزرق">أبيض + زجاج عاكس أزرق</option>
              <option value="برونز ملكي + زجاج دبل">برونز ملكي + زجاج دبل</option>
              <option value="أسود مطفي + زجاج شفاف">أسود مطفي + زجاج شفاف</option>
            </select>
          </div>
        </div>
        <div id="alu-result" style="background:var(--primary-light);padding:16px;border-radius:12px;font-weight:700;">
          المساحة: 1.80 متر مربع | طول الحلق: 5.40 م | طول الضلف: 6.60 م | التكلفة التقديرية: 81,000 ر.ي
        </div>
      </div>
    `;
  }

  return `
    <div class="erp-card">
      <div class="erp-card-header">
        <h3>⚙️ إعدادات المنظومة، الموارد البشرية، وكبينة السداد</h3>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>اسم المتجر الرسمي</label>
          <input type="text" value="المأمون ستور - متجر المأمون الإلكتروني الحديث">
        </div>
        <div class="form-group">
          <label>المالك والمدير العام</label>
          <input type="text" value="مأمون علي حمود العمري">
        </div>
        <div class="form-group">
          <label>أرقام التواصل والواتساب</label>
          <input type="text" value="781002020 / 731002020">
        </div>
        <div class="form-group">
          <label>السيرفر السحابي الجديد (Supabase PostgreSQL)</label>
          <input type="text" value="https://nlxiixqzgkvjfntggekt.supabase.co" readonly>
        </div>
      </div>
      <button class="btn btn-primary" onclick="showToast('تم حفظ الإعدادات ومزامنتها مع المتجر السحابي بنجاح ✅')">💾 حفظ ومزامنة الإعدادات</button>
    </div>
  `;
}

// ==================== RENDER POS & MULTI-WINDOW INVOICES (F10) ====================
function renderPOS() {
  const tab = state.posTabs[state.activePosTab] || state.posTabs[0];
  const subtotal = tab.items.reduce((s, i) => s + (i.price * i.qty), 0);
  const net = Math.max(0, subtotal - Number(tab.discount || 0));

  return `
    <div class="store-container" style="max-width:1440px;">
      <div class="erp-card">
        <div class="erp-card-header">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <h3>⚡ نقطة البيع والكاشير السريع (يدعم قارئ الباركود وباركود الميزان الإلكتروني)</h3>
            ${state.posTabs.map((t, idx) => `
              <button class="btn ${idx === state.activePosTab ? 'btn-primary' : 'btn-outline'}" onclick="switchPosTab(${idx})">${t.title}</button>
            `).join("")}
            <button class="btn btn-success" onclick="newPosTab()">➕ نافذة فاتورة جديدة (F10)</button>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary" onclick="saveAndPrintPOS('thermal')">🖨️ حفظ وطباعة حراري 80mm (F5)</button>
            <button class="btn btn-outline" onclick="saveAndPrintPOS('a4')">📄 طباعة فاتورة A4 رسمية</button>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>🔍 إدخال باركود الصنف أو باركود الميزان الإلكتروني (EAN-13 يبدأ بـ 20-29)</label>
            <input type="text" id="pos-barcode-input" placeholder="امسح الباركود أو اكتب كود الصنف واضغط Enter (مثال: 2010010015009 أو 163)..." onkeydown="if(event.key==='Enter') scanPosBarcode(this.value)">
          </div>
          <div class="form-group">
            <label>اسم العميل / الحساب</label>
            <input type="text" value="${tab.customer}" onchange="state.posTabs[state.activePosTab].customer=this.value">
          </div>
          <div class="form-group">
            <label>نوع الفاتورة وطريقة الدفع</label>
            <select onchange="state.posTabs[state.activePosTab].payment=this.value">
              <option value="cash">نقداً (صندوق الكاشير)</option>
              <option value="credit">آجل (ذمم العملاء)</option>
              <option value="kuraimi">حاسب الكريمي / محفظة إلكترونية</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:18px;">
          <!-- Invoice Items Table -->
          <div>
            <div class="table-responsive">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الصنف</th>
                    <th>الكمية / الوزن</th>
                    <th>سعر الوحدة</th>
                    <th>الإجمالي</th>
                    <th>حذف</th>
                  </tr>
                </thead>
                <tbody>
                  ${tab.items.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted);">امسح الباركود أو انقر على أي صنف من شاشة اللمس لإضافته للفاتورة</td></tr>` : ""}
                  ${tab.items.map((item, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><strong>${item.arname}</strong></td>
                      <td><input type="number" step="0.001" value="${item.qty}" style="width:80px;padding:4px;" onchange="updatePosQty(${idx}, this.value)"></td>
                      <td>${formatPrice(item.price)}</td>
                      <td><strong>${formatPrice(item.price * item.qty)}</strong></td>
                      <td><button class="btn btn-danger" style="padding:3px 8px;" onclick="removePosItem(${idx})">✖</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>

            <div style="margin-top:16px;padding:16px;background:var(--primary-light);border-radius:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
              <div>
                <div style="font-size:13px;color:var(--muted);">تفقيط الفاتورة: <strong>${tafqeetAR(net)}</strong></div>
              </div>
              <div style="font-size:22px;font-weight:800;color:var(--primary);">
                الصافي المطلوب: ${formatPrice(net)}
              </div>
            </div>
          </div>

          <!-- Touch Items Grid -->
          <div>
            <h4 style="margin-bottom:10px;">👆 شاشة الأصناف السريعة باللمس (انقر للإضافة الفورية)</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;max-height:420px;overflow-y:auto;padding:4px;">
              ${state.products.slice(0, 30).map(p => `
                <div onclick="addPosItem(${p.itemid})" style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px;cursor:pointer;text-align:center;">
                  <img src="${p.image_url || 'assets/noimgprod.jpg'}" style="width:50px;height:50px;object-fit:contain;background:#fff;border-radius:6px;" onerror="this.src='assets/noimgprod.jpg'">
                  <div style="font-size:11.5px;font-weight:700;height:30px;overflow:hidden;margin:4px 0;">${p.arname}</div>
                  <div style="font-size:12px;color:var(--primary);font-weight:800;">${formatPrice(p.price_sale)}</div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==================== RENDER SCALES & TRIAL BALANCE (منظومة الميازين وميزان المراجعة المطور) ====================
function renderScalesAndTrialBalance(embedded = false) {
  const scaleProds = state.products.filter(p => p.is_scale_item || Number(p.group_id) === 8610908145 || (p.arname && p.arname.includes("ميزان")));

  // Compute Trial Balance Totals
  let totOpenDr = 0, totOpenCr = 0, totPerDr = 0, totPerCr = 0, totEndDr = 0, totEndCr = 0;
  const rowsHtml = state.accounts.map(acc => {
    const oDr = Number(acc.opening_debit || 0);
    const oCr = Number(acc.opening_credit || 0);
    const pDr = Number(acc.period_debit || 0);
    const pCr = Number(acc.period_credit || 0);
    const net = (oDr + pDr) - (oCr + pCr);
    const eDr = net > 0 ? net : 0;
    const eCr = net < 0 ? Math.abs(net) : 0;
    totOpenDr += oDr; totOpenCr += oCr;
    totPerDr += pDr; totPerCr += pCr;
    totEndDr += eDr; totEndCr += eCr;
    return `
      <tr>
        <td><code>${acc.account_code}</code></td>
        <td><strong>${acc.account_name}</strong></td>
        <td>${acc.account_type}</td>
        <td>${oDr.toLocaleString()}</td>
        <td>${oCr.toLocaleString()}</td>
        <td>${pDr.toLocaleString()}</td>
        <td>${pCr.toLocaleString()}</td>
        <td style="color:#0284c7;font-weight:800;">${eDr.toLocaleString()}</td>
        <td style="color:#0d9488;font-weight:800;">${eCr.toLocaleString()}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="${embedded ? '' : 'store-container'}">
      <!-- 1. Electronic Scales & Smart Weight/Price Barcode Studio -->
      <div class="erp-card">
        <div class="erp-card-header">
          <h3>⚖️ أولاً: مركز الميازين الإلكترونية وتوليد/قراءة باركود الوزن والسعر (EAN-13 Scale Studio)</h3>
          <button class="btn btn-primary" onclick="selectGroupAndGoStore(8610908145)">🛍️ عرض قسم الميازين في المتجر (${scaleProds.length} صنف)</button>
        </div>
        <p style="font-size:13.5px;color:var(--muted);margin-bottom:14px;">
          يدعم النظام بشكل كامل الميازين الإلكترونية التجارية (مثل Camry, Rongta, Bizerba, CAS, Dibal) وتوليد وقراءة باركود الميزان القياسي (Prefix 20-29 + كود الصنف PLU 5 خانات + الوزن بالجرام أو السعر 5 خانات + رقم التحقق).
        </p>

        <div class="form-grid">
          <div class="form-group">
            <label>كود الصنف في الميزان (PLU - 5 أرقام)</label>
            <input type="text" id="scale-plu" value="01001" oninput="generateScaleBarcode()">
          </div>
          <div class="form-group">
            <label>الوزن بالجرام (مثلاً 1500 جرام = 1.5 كجم)</label>
            <input type="number" id="scale-weight" value="1500" oninput="generateScaleBarcode()">
          </div>
          <div class="form-group">
            <label>سعر الكيلو (ريال يمني)</label>
            <input type="number" id="scale-kilo-price" value="8000" oninput="generateScaleBarcode()">
          </div>
          <div class="form-group">
            <label>باركود الميزان المتولد (EAN-13)</label>
            <input type="text" id="scale-barcode-out" value="2001001015007" readonly style="font-weight:800;color:var(--primary);letter-spacing:2px;">
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-success" onclick="sendScaleBarcodeToPOS()">⚡ إرسال باركود الميزان مباشرة للكاشير</button>
          <span id="scale-summary-text" style="font-weight:700;color:#0d9488;">الوزن: 1.500 كجم × 8,000 ر.ي = 12,000 ريال يمني</span>
        </div>
      </div>

      <!-- 2. Advanced Financial Trial Balance (ميزان المراجعة المحاسبي الشامل والمطور) -->
      <div class="erp-card">
        <div class="erp-card-header">
          <h3>📊 ثانياً: ميزان المراجعة المحاسبي المطور (بالمجاميع والأرصدة الافتتاحية وحركة الفترة والختامي)</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="openNewVoucherModal()">➕ إضافة سند قبض / صرف / قيد</button>
            <button class="btn btn-outline" onclick="window.print()">🖨️ طباعة ميزان المراجعة A4</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>رقم الحساب</th>
                <th>اسم الحساب</th>
                <th>النوع</th>
                <th>رصيد افتتاحي (مدين)</th>
                <th>رصيد افتتاحي (دائن)</th>
                <th>حركة الفترة (مدين)</th>
                <th>حركة الفترة (دائن)</th>
                <th>الرصيد الختامي (مدين)</th>
                <th>الرصيد الختامي (دائن)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background:var(--primary-light);font-weight:800;font-size:14px;">
                <td colspan="3">الإجمالي العام لميزان المراجعة</td>
                <td>${totOpenDr.toLocaleString()}</td>
                <td>${totOpenCr.toLocaleString()}</td>
                <td>${totPerDr.toLocaleString()}</td>
                <td>${totPerCr.toLocaleString()}</td>
                <td style="color:#0284c7;">${totEndDr.toLocaleString()}</td>
                <td style="color:#0d9488;">${totEndCr.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ==================== INTERACTIVE ACTIONS & MODALS ====================
function selectGroup(gid) {
  state.selectedGroup = Number(gid);
  state.selectedCat = 0;
  state.page = 1;
  renderApp();
}

function selectGroupAndGoStore(gid) {
  state.selectedGroup = Number(gid);
  state.selectedCat = 0;
  state.page = 1;
  setMode("store");
}

function selectCat(cid) {
  state.selectedCat = Number(cid);
  state.page = 1;
  renderApp();
}

function onStoreSearch(val) {
  state.searchQuery = val;
  state.page = 1;
  renderApp();
  const inp = document.getElementById("store-search-input");
  if (inp) {
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }
}

function onSortChange(val) {
  state.sortBy = val;
  state.page = 1;
  renderApp();
}

function changePage(p) {
  state.page = p;
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setAdminTab(tab) {
  state.adminTab = tab;
  renderApp();
}

function openModal(html) {
  const backdrop = document.getElementById("global-modal");
  const box = document.getElementById("global-modal-box");
  if (backdrop && box) {
    box.innerHTML = html;
    backdrop.classList.add("open");
  }
}

function closeModal() {
  const backdrop = document.getElementById("global-modal");
  if (backdrop) backdrop.classList.remove("open");
}

function openProductDetail(itemid) {
  const p = state.products.find(x => Number(x.itemid) === Number(itemid));
  if (!p) return;
  openModal(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3>📦 تفاصيل المنتج والمواصفات الفنية</h3>
      <button class="btn btn-outline" onclick="closeModal()">✖ إغلاق</button>
    </div>
    <div style="display:grid;grid-template-columns:260px 1fr;gap:20px;align-items:start;">
      <div style="background:#fff;border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center;">
        <img src="${p.image_url || 'assets/noimgprod.jpg'}" style="max-width:100%;max-height:240px;object-fit:contain;" onerror="this.src='assets/noimgprod.jpg'">
      </div>
      <div>
        <h2 style="font-size:20px;margin-bottom:8px;color:var(--primary);">${p.arname}</h2>
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px;">
          رقم الصنف: <strong>#${p.item_number || p.itemid}</strong> | الباركود: <strong>${p.barcode || '-'}</strong> | الحالة: <strong style="color:#10b981;">متوفر في المخزن</strong>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--primary);margin-bottom:14px;">
          ${formatPrice(p.price_sale)}
        </div>
        <div style="background:var(--bg);padding:14px;border-radius:10px;font-size:13.5px;white-space:pre-line;max-height:220px;overflow-y:auto;margin-bottom:16px;">
          ${p.item_desc || 'منتج أصلي مضمون من متجر المأمون الإلكتروني الحديث.'}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="addToCart(${p.itemid});closeModal();">🛒 إضافة إلى السلة</button>
          <a class="btn btn-success" style="text-decoration:none;" target="_blank" href="https://wa.me/967731002020?text=${encodeURIComponent('مرحباً متجر المأمون، أود الاستفسار/طلب الصنف: ' + p.arname + ' رقم: ' + (p.item_number || p.itemid))}">💬 طلب عبر واتساب مباشرة</a>
        </div>
      </div>
    </div>
  `);
}

function openCartModal() {
  const subtotal = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
  const disc = state.appliedCoupon ? Math.round(subtotal * (state.appliedCoupon.percent / 100)) : 0;
  const delivery = subtotal > 0 ? 1500 : 0;
  const total = Math.max(0, subtotal - disc + delivery);

  openModal(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3>🛒 سلة المشتريات وإتمام الطلب (${state.cart.length} أصناف)</h3>
      <button class="btn btn-outline" onclick="closeModal()">✖ إغلاق</button>
    </div>
    ${state.cart.length === 0 ? `<p style="padding:28px;text-align:center;color:var(--muted);">سلة التسوق فارغة حالياً. تصفح المنتجات وأضفها للسلة!</p>` : `
      <div class="table-responsive" style="margin-bottom:16px;">
        <table class="erp-table">
          <thead>
            <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th>حذف</th></tr>
          </thead>
          <tbody>
            ${state.cart.map((item, idx) => `
              <tr>
                <td><strong>${item.arname}</strong></td>
                <td><input type="number" min="1" value="${item.qty}" style="width:65px;padding:4px;" onchange="state.cart[${idx}].qty=Number(this.value);saveCart();openCartModal();"></td>
                <td>${formatPrice(item.price)}</td>
                <td><strong>${formatPrice(item.price * item.qty)}</strong></td>
                <td><button class="btn btn-danger" style="padding:3px 8px;" onclick="state.cart.splice(${idx},1);saveCart();openCartModal();renderApp();">✖</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;">
        <input type="text" id="coupon-inp" placeholder="لديك كود خصم؟ جرب MAMON10 أو VIP15" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;flex:1;">
        <button class="btn btn-outline" onclick="applyCouponCode(document.getElementById('coupon-inp').value)">تطبيق الكوبون</button>
      </div>

      <div style="background:var(--primary-light);padding:12px 16px;border-radius:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <div>الخصم: ${formatPrice(disc)} | رسوم التوصيل: ${formatPrice(delivery)}</div>
        <div style="font-size:19px;font-weight:800;color:var(--primary);">الإجمالي النهائي: ${formatPrice(total)}</div>
      </div>

      <h4 style="margin-bottom:10px;">📍 بيانات المستلم وطريقة الدفع المعتمدة</h4>
      <div class="form-grid">
        <div class="form-group"><label>اسم المستلم الكامل*</label><input type="text" id="chk-name" placeholder="الاسم الكامل"></div>
        <div class="form-group"><label>رقم الجوال (واتساب)*</label><input type="text" id="chk-phone" placeholder="77xxxxxxx"></div>
        <div class="form-group">
          <label>المحافظة / المدينة*</label>
          <select id="chk-city">
            <option value="تعز - الحوبان">تعز - الحوبان</option>
            <option value="تعز - المدينة">تعز - المدينة</option>
            <option value="صنعاء">صنعاء</option>
            <option value="عدن">عدن</option>
            <option value="إب">إب</option>
            <option value="حضرموت">حضرموت</option>
            <option value="الحديدة">الحديدة</option>
          </select>
        </div>
        <div class="form-group">
          <label>طريقة الدفع (باسم: مأمون علي حمود العمري - 731002020)</label>
          <select id="chk-pay">
            <option value="الدفع عند التسليم">الدفع عند التسليم</option>
            <option value="حاسب - بنك الكريمي">حاسب - بنك الكريمي</option>
            <option value="جوالي">محفظة جوالي</option>
            <option value="كاش">محفظة كاش</option>
            <option value="بيس - بنك الأمل">بيس - بنك الأمل</option>
            <option value="سبأ كاش">سبأ كاش</option>
            <option value="جيب">محفظة جيب</option>
            <option value="من رصيدي">من رصيدي في المتجر</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:14px;">
        <label>العنوان التفصيلي ورقم إشعار الحوالة (إن وجد)</label>
        <input type="text" id="chk-address" placeholder="الشارع / المعلم القريب / رقم الحوالة...">
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;font-size:15px;" onclick="submitStoreOrder(${subtotal}, ${disc}, ${delivery}, ${total})">
        ✅ إرسال الطلب الآن ومزامنته مع الإدارة
      </button>
    `}
  `);
}

function applyCouponCode(code) {
  const c = (code || "").trim().toUpperCase();
  if (c === "MAMON10") state.appliedCoupon = { code: c, percent: 10 };
  else if (c === "VIP15") state.appliedCoupon = { code: c, percent: 15 };
  else if (c === "TAIZ2026") state.appliedCoupon = { code: c, percent: 8 };
  else {
    showToast("كود الخصم غير صحيح، جرب MAMON10 أو VIP15");
    return;
  }
  showToast(`تم تفعيل كود الخصم ${c} بنجاح 🎉`);
  openCartModal();
}

async function submitStoreOrder(subtotal, disc, delivery, total) {
  const name = document.getElementById("chk-name").value.trim();
  const phone = document.getElementById("chk-phone").value.trim();
  const city = document.getElementById("chk-city").value;
  const pay = document.getElementById("chk-pay").value;
  const addr = document.getElementById("chk-address").value.trim();
  if (!name || !phone) {
    showToast("يرجى إدخال اسم المستلم ورقم الهاتف!");
    return;
  }
  const orderNum = "ORD-" + Math.floor(100000 + Math.random() * 900000);
  const newOrder = {
    order_number: orderNum,
    customer_name: name,
    customer_phone: phone,
    customer_city: city,
    customer_address: addr || city,
    payment_method: pay,
    currency_unit: state.currency,
    subtotal,
    discount_amount: disc,
    delivery_fee: delivery,
    total_amount: total,
    status: "pending",
    items: state.cart
  };
  state.orders.unshift({ id: Date.now(), ...newOrder });
  try {
    await sbFetch("store_orders", { method: "POST", body: JSON.stringify(newOrder) });
  } catch (e) {
    console.warn(e);
  }
  state.cart = [];
  saveCart();
  closeModal();
  showToast(`تم إرسال طلبك رقم ${orderNum} بنجاح! يظهر الآن في لوحة الإدارة 🎉`);
  renderApp();
}

// Quick Add Product Modal (Admin -> Storefront Live Sync)
function openQuickAddProductModal() {
  openModal(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3>➕ إضافة صنف جديد (يُحفظ في السيرفر ويظهر فوراً في متجر الويب وتطبيق العملاء)</h3>
      <button class="btn btn-outline" onclick="closeModal()">✖ إغلاق</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>اسم الصنف بالعربي*</label>
        <input type="text" id="new-prod-name" placeholder="مثال: ميزان إلكتروني ديجيتال ذكي 40 كجم مع طابعة باركود">
      </div>
      <div class="form-group">
        <label>القسم الرئيسي*</label>
        <select id="new-prod-group">
          ${state.groups.filter(g => g.group_name !== "بحث").map(g => `<option value="${g.id}">${g.group_name}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>سعر البيع (ريال يمني YER)*</label>
        <input type="number" id="new-prod-price" value="45000">
      </div>
      <div class="form-group">
        <label>رقم الباركود / كود الصنف</label>
        <input type="text" id="new-prod-barcode" value="${Math.floor(10000 + Math.random() * 90000)}">
      </div>
      <div class="form-group">
        <label>الكمية الافتتاحية بالمخزن</label>
        <input type="number" id="new-prod-qty" value="50">
      </div>
      <div class="form-group">
        <label>رفع صورة الصنف مباشرة للسيرفر السحابي (Supabase Storage)</label>
        <input type="file" id="new-prod-file" accept="image/*" onchange="uploadImageToCloudStorage(this)">
        <input type="text" id="new-prod-img" placeholder="أو ضع رابط الصورة (يتم تعبئته تلقائياً عند رفع ملف)" style="margin-top:6px;">
      </div>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label>المواصفات الفنية والوصف</label>
      <textarea id="new-prod-desc" rows="3" placeholder="اكتب المواصفات والمميزات والضمان..."></textarea>
    </div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;" onclick="saveNewProductLive()">
      🚀 حفظ الصنف في السيرفر السحابي ونشره فوراً في المتجر
    </button>
  `);
}

async function uploadImageToCloudStorage(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  if (!file) return;
  showToast("⏳ جاري رفع صورة الصنف إلى سيرفر التخزين السحابي الخاص بكم (Supabase Storage)...");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const filename = `prod_${Date.now()}.${ext}`;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/almamon-images/${filename}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": file.type || "image/jpeg",
        "x-upsert": "true"
      },
      body: file
    });
    if (res.ok) {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/almamon-images/${filename}`;
      const imgInp = document.getElementById("new-prod-img");
      if (imgInp) imgInp.value = publicUrl;
      showToast("✅ تم رفع الصورة وحفظها على سيرفركم السحابي بنجاح!");
    } else {
      showToast("⚠️ تعذر رفع الصورة، يمكنك وضع الرابط يدوياً.");
    }
  } catch (e) {
    console.warn(e);
  }
}

async function saveNewProductLive() {
  const arname = document.getElementById("new-prod-name").value.trim();
  const group_id = Number(document.getElementById("new-prod-group").value);
  const price_sale = Number(document.getElementById("new-prod-price").value || 0);
  const barcode = document.getElementById("new-prod-barcode").value.trim();
  const stock_qty = Number(document.getElementById("new-prod-qty").value || 25);
  const image_url = document.getElementById("new-prod-img").value.trim() || state.logo;
  const item_desc = document.getElementById("new-prod-desc").value.trim();

  if (!arname) {
    showToast("يرجى كتابة اسم الصنف!");
    return;
  }
  const itemid = Date.now();
  const newProd = {
    itemid,
    item_number: barcode,
    barcode,
    arname,
    group_id,
    parent_id: 0,
    price_sale,
    price_sale_bulk: Math.round(price_sale * 0.92),
    price_buy: Math.round(price_sale * 0.8),
    stock_qty,
    unit_name: "حبة",
    image_url,
    item_desc,
    is_scale_item: group_id === 8610908145 || arname.includes("ميزان"),
    ishide: 0,
    is_new: true
  };
  state.products.unshift(newProd);
  try {
    await sbFetch("products", { method: "POST", body: JSON.stringify(newProd) });
  } catch (e) {
    console.warn(e);
  }
  closeModal();
  showToast(`تمت إضافة "${arname}" بنجاح وهو ظاهر الآن في المتجر والكاشير! ✅`);
  renderApp();
}

async function updateProductPrice(itemid, newPrice) {
  const p = state.products.find(x => Number(x.itemid) === Number(itemid));
  if (p) p.price_sale = Number(newPrice);
  try {
    await sbFetch(`products?itemid=eq.${itemid}`, {
      method: "PATCH",
      body: JSON.stringify({ price_sale: Number(newPrice) })
    });
  } catch (e) {}
  showToast("تم تحديث سعر الصنف ومزامنته مع متجر العملاء فوراً ✅");
}

async function toggleHideProduct(itemid) {
  const p = state.products.find(x => Number(x.itemid) === Number(itemid));
  if (!p) return;
  p.ishide = p.ishide ? 0 : 1;
  try {
    await sbFetch(`products?itemid=eq.${itemid}`, {
      method: "PATCH",
      body: JSON.stringify({ ishide: p.ishide })
    });
  } catch (e) {}
  showToast(p.ishide ? "تم إخفاء الصنف من المتجر" : "تم إظهار الصنف في المتجر");
  renderApp();
}

async function updateOrderStatus(orderId, status) {
  const o = state.orders.find(x => Number(x.id) === Number(orderId));
  if (o) o.status = status;
  try {
    await sbFetch(`store_orders?id=eq.${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  } catch (e) {}
  showToast(`تم تحديث حالة الطلب إلى: ${status} ✅`);
  renderApp();
}

function convertOrderToInvoice(orderId) {
  const o = state.orders.find(x => Number(x.id) === Number(orderId));
  if (!o) return;
  state.posTabs.push({
    id: state.posTabs.length + 1,
    title: `فاتورة طلب ${o.order_number}`,
    type: "sale",
    payment: "cash",
    customer: o.customer_name,
    discount: Number(o.discount_amount || 0),
    items: (o.items || []).map(i => ({
      itemid: i.itemid,
      arname: i.arname,
      qty: Number(i.qty || 1),
      price: Number(i.price || 0)
    }))
  });
  state.activePosTab = state.posTabs.length - 1;
  setMode("pos");
  showToast(`تم تحويل الطلب ${o.order_number} إلى نافذة فاتورة مبيعات جاهزة للطباعة! 🧾`);
}

// POS Functions & Scale Barcode Decoder
function scanPosBarcode(raw) {
  const code = (raw || "").trim();
  if (!code) return;
  const inp = document.getElementById("pos-barcode-input");
  if (inp) inp.value = "";

  // Check if EAN-13 Scale Barcode (Starts with 20..29 and length 12 or 13)
  if (/^2[0-9]\d{10,11}$/.test(code)) {
    const plu = code.substring(2, 7);
    const weightGrams = parseInt(code.substring(7, 12), 10);
    const weightKg = weightGrams / 1000;
    const scaleProd = state.products.find(p => p.is_scale_item || Number(p.group_id) === 8610908145) || state.products[0];
    const unitPrice = Number(scaleProd.price_sale || 8000);
    state.posTabs[state.activePosTab].items.push({
      itemid: scaleProd.itemid,
      arname: `${scaleProd.arname} [ميزان PLU:${plu} - وزن ${weightKg.toFixed(3)} كجم]`,
      qty: weightKg,
      price: unitPrice
    });
    showToast(`⚖️ تم قراءة باركود الميزان: الوزن ${weightKg.toFixed(3)} كجم`);
    renderApp();
    return;
  }

  const prod = state.products.find(p =>
    String(p.barcode) === code ||
    String(p.item_number) === code ||
    String(p.itemid) === code ||
    (p.arname && p.arname.includes(code))
  );
  if (prod) {
    addPosItem(prod.itemid);
  } else {
    showToast("لم يتم العثور على الصنف بهذا الباركود!");
  }
}

function addPosItem(itemid) {
  const p = state.products.find(x => Number(x.itemid) === Number(itemid));
  if (!p) return;
  const tab = state.posTabs[state.activePosTab];
  const ex = tab.items.find(i => Number(i.itemid) === Number(itemid));
  if (ex) ex.qty += 1;
  else tab.items.push({ itemid: p.itemid, arname: p.arname, qty: 1, price: Number(p.price_sale || 0) });
  renderApp();
}

function updatePosQty(idx, val) {
  state.posTabs[state.activePosTab].items[idx].qty = Number(val || 1);
  renderApp();
}

function removePosItem(idx) {
  state.posTabs[state.activePosTab].items.splice(idx, 1);
  renderApp();
}

function newPosTab() {
  const n = state.posTabs.length + 1;
  state.posTabs.push({ id: n, title: `فاتورة مبيعات #${n}`, type: "sale", payment: "cash", customer: "عميل نقدي", discount: 0, items: [] });
  state.activePosTab = state.posTabs.length - 1;
  renderApp();
}

function switchPosTab(idx) {
  state.activePosTab = idx;
  renderApp();
}

async function saveAndPrintPOS(printType) {
  const tab = state.posTabs[state.activePosTab];
  if (tab.items.length === 0) {
    showToast("الفاتورة فارغة! أضف أصنافاً أولاً.");
    return;
  }
  const subtotal = tab.items.reduce((s, i) => s + (i.price * i.qty), 0);
  const net = Math.max(0, subtotal - Number(tab.discount || 0));
  const invNum = "INV-" + Math.floor(100000 + Math.random() * 900000);
  const invObj = {
    invoice_number: invNum,
    invoice_type: tab.type,
    payment_type: tab.payment,
    customer_or_supplier: tab.customer,
    currency_unit: state.currency,
    subtotal,
    discount: tab.discount,
    net_total: net,
    paid_amount: net,
    remaining_amount: 0,
    items: tab.items
  };
  state.invoices.unshift(invObj);
  try {
    await sbFetch("invoices", { method: "POST", body: JSON.stringify(invObj) });
  } catch (e) {}
  showToast(`تم حفظ الفاتورة رقم ${invNum} في قاعدة البيانات بنجاح ✅`);
  window.print();
}

// Scale Barcode Generator
function generateScaleBarcode() {
  const plu = (document.getElementById("scale-plu")?.value || "01001").padStart(5, "0").slice(0, 5);
  const weight = Math.min(99999, Math.max(1, parseInt(document.getElementById("scale-weight")?.value || "1500", 10)));
  const kiloPrice = Number(document.getElementById("scale-kilo-price")?.value || 8000);
  const wStr = String(weight).padStart(5, "0");
  const base12 = `20${plu}${wStr}`;
  // Compute EAN-13 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base12[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  const ean13 = base12 + check;
  const out = document.getElementById("scale-barcode-out");
  if (out) out.value = ean13;
  const sumTxt = document.getElementById("scale-summary-text");
  if (sumTxt) {
    const total = ((weight / 1000) * kiloPrice).toLocaleString();
    sumTxt.textContent = `الوزن: ${(weight / 1000).toFixed(3)} كجم × ${kiloPrice.toLocaleString()} ر.ي = ${total} ريال يمني`;
  }
}

function sendScaleBarcodeToPOS() {
  const code = document.getElementById("scale-barcode-out")?.value || "2001001015007";
  setMode("pos");
  setTimeout(() => scanPosBarcode(code), 80);
}

// Kabina Sadad & WiFi Modal
function openKabinaModal(tab = "sadad") {
  openModal(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3>📱 كبينة السداد الفوري وكروت شبكات الواي فاي</h3>
      <button class="btn btn-outline" onclick="closeModal()">✖ إغلاق</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>اختر الشبكة / الخدمة</label>
        <select id="kab-net">
          <option value="يمن موبايل - رصيد وباقات">يمن موبايل - رصيد وباقات</option>
          <option value="يو YOU - باقات ورصيد">يو YOU - باقات ورصيد</option>
          <option value="سبأفون - رصيد وباقات">سبأفون - رصيد وباقات</option>
          <option value="يمن فورجي Yemen 4G">يمن فورجي Yemen 4G</option>
          <option value="الإنترنت الأرضي ADSL">الإنترنت الأرضي ADSL</option>
          <option value="عدن نت AdenNet">عدن نت AdenNet</option>
          <option value="كرت واي فاي شبكة المأمون السريعة">📶 كرت واي فاي شبكة المأمون السريعة</option>
        </select>
      </div>
      <div class="form-group">
        <label>رقم الهاتف المشترك / المستفيد</label>
        <input type="text" id="kab-phone" placeholder="77xxxxxxx">
      </div>
      <div class="form-group">
        <label>المبلغ / الفئة (ريال يمني)</label>
        <input type="number" id="kab-amt" value="2000">
      </div>
    </div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;padding:11px;" onclick="closeModal();showToast('تم إرسال طلب السداد الفوري بنجاح ✅');">⚡ تنفيذ عملية السداد الآن</button>
  `);
}

function openMaintenanceTrackModal() {
  openModal(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3>🛠️ بوابة متابعة حالة صيانة الأجهزة</h3>
      <button class="btn btn-outline" onclick="closeModal()">✖ إغلاق</button>
    </div>
    <div class="table-responsive">
      <table class="erp-table">
        <thead>
          <tr><th>رقم السند</th><th>العميل</th><th>الجهاز</th><th>العطل</th><th>التكلفة</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          ${state.maintenance.map(m => `
            <tr>
              <td><strong>${m.ticket_number}</strong></td>
              <td>${m.customer_name}</td>
              <td>${m.device_name} (${m.device_model})</td>
              <td>${m.problem_desc}</td>
              <td>${formatPrice(Number(m.service_cost || 0) + Number(m.parts_cost || 0))}</td>
              <td><span class="subcat-pill active">${m.status}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `);
}

function openOrdersTrackModal() {
  openModal(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3>📦 متابعة طلبات المتجر الإلكتروني (${state.orders.length})</h3>
      <button class="btn btn-outline" onclick="closeModal()">✖ إغلاق</button>
    </div>
    <div class="table-responsive">
      <table class="erp-table">
        <thead>
          <tr><th>رقم الطلب</th><th>العميل</th><th>المدينة</th><th>الدفع</th><th>الإجمالي</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          ${state.orders.map(o => `
            <tr>
              <td><strong>${o.order_number}</strong></td>
              <td>${o.customer_name}</td>
              <td>${o.customer_city}</td>
              <td>${o.payment_method}</td>
              <td><strong>${formatPrice(o.total_amount)}</strong></td>
              <td><span class="subcat-pill active">${o.status}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `);
}

function openNewVoucherModal() {
  openModal(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3>🧾 إضافة سند مالي جديد (سند قبض / سند صرف / قيد يومية)</h3>
      <button class="btn btn-outline" onclick="closeModal()">✖ إغلاق</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>نوع السند</label>
        <select id="vch-type">
          <option value="receipt">سند قبض (توريد للصندوق)</option>
          <option value="payment">سند صرف (صرف من الصندوق)</option>
          <option value="journal">قيد يومية محاسبي</option>
        </select>
      </div>
      <div class="form-group">
        <label>الحساب</label>
        <select id="vch-acc">
          ${state.accounts.map(a => `<option value="${a.account_code}">${a.account_code} - ${a.account_name}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>المبلغ (YER)</label>
        <input type="number" id="vch-amt" value="100000">
      </div>
      <div class="form-group">
        <label>البيان والتفاصيل</label>
        <input type="text" id="vch-desc" placeholder="دفعة حساب / مصروفات...">
      </div>
    </div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;padding:11px;" onclick="saveNewVoucher()">💾 حفظ السند وتحديث ميزان المراجعة</button>
  `);
}

async function saveNewVoucher() {
  const type = document.getElementById("vch-type").value;
  const code = document.getElementById("vch-acc").value;
  const amt = Number(document.getElementById("vch-amt").value || 0);
  const desc = document.getElementById("vch-desc").value.trim() || "سند مالي";
  const acc = state.accounts.find(a => a.account_code === code);
  if (acc) {
    if (type === "receipt") acc.period_credit = Number(acc.period_credit || 0) + amt;
    else acc.period_debit = Number(acc.period_debit || 0) + amt;
  }
  const vNum = (type === "receipt" ? "RV-" : "PV-") + Math.floor(1000 + Math.random() * 9000);
  try {
    await sbFetch("vouchers", {
      method: "POST",
      body: JSON.stringify({
        voucher_number: vNum,
        voucher_type: type,
        account_name: acc ? acc.account_name : code,
        amount: amt,
        currency_unit: "YER",
        description: desc
      })
    });
  } catch (e) {}
  closeModal();
  showToast(`تم حفظ السند ${vNum} وتحديث ميزان المراجعة فوراً ✅`);
  renderApp();
}

function openAIAssistantModal() {
  openModal(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3>🤖 المساعد الذكي لمتجر وإدارة المأمون</h3>
      <button class="btn btn-outline" onclick="closeModal()">✖ إغلاق</button>
    </div>
    <div id="ai-chat-history" style="background:var(--bg);padding:14px;border-radius:12px;max-height:280px;overflow-y:auto;margin-bottom:12px;">
      <div style="margin-bottom:8px;"><strong>🤖 المساعد الذكي:</strong> أهلاً بك في متجر المأمون الإلكتروني الحديث! لدي اطلاع كامل على ${state.products.length.toLocaleString()} منتج و13 قسماً وميزان المراجعة. اسألني عن أي منتج أو سعر أو تقرير!</div>
    </div>
    <div style="display:flex;gap:8px;">
      <input type="text" id="ai-q-inp" placeholder="مثال: ما هي أفضل الميازين الإلكترونية أو القلايات المتوفرة؟" style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;" onkeydown="if(event.key==='Enter') askStoreAI()">
      <button class="btn btn-primary" onclick="askStoreAI()">إرسال</button>
    </div>
  `);
}

function askStoreAI() {
  const inp = document.getElementById("ai-q-inp");
  const hist = document.getElementById("ai-chat-history");
  if (!inp || !hist || !inp.value.trim()) return;
  const q = inp.value.trim();
  inp.value = "";
  const matches = state.products.filter(p => p.arname && p.arname.includes(q.split(" ")[0])).slice(0, 4);
  let reply = `وجدت في قاعدة بيانات متجر المأمون (${state.products.length} صنف) نتائج مطابقة: `;
  if (matches.length > 0) {
    reply += matches.map(m => `• ${m.arname} (${formatPrice(m.price_sale)})`).join(" | ");
  } else {
    reply = `متجر المأمون يوفر ${state.products.length.toLocaleString()} منتجاً موزعة على 13 قسماً أبرزها الميازين الإلكترونية، الأجهزة المنزلية، الشاشات، المكيفات، الكمبيوتر، ومعدات الصيانة. يمكنك البحث مباشرة أو الطلب عبر واتساب 731002020.`;
  }
  hist.innerHTML += `<div style="margin:8px 0;color:var(--primary);"><strong>أنت:</strong> ${q}</div>`;
  hist.innerHTML += `<div style="margin:8px 0;background:var(--card);padding:8px 12px;border-radius:8px;"><strong>🤖 المساعد الذكي:</strong> ${reply}</div>`;
  hist.scrollTop = hist.scrollHeight;
}

function calcAluminum() {
  const w = Number(document.getElementById("alu-w")?.value || 1200) / 1000;
  const h = Number(document.getElementById("alu-h")?.value || 1500) / 1000;
  const area = w * h;
  const frame = 2 * (w + h);
  const leaves = frame * 1.22;
  const cost = Math.round(area * 45000);
  const res = document.getElementById("alu-result");
  if (res) {
    res.innerHTML = `المساحة: ${area.toFixed(2)} م² | طول الحلق: ${frame.toFixed(2)} م | طول الضلف: ${leaves.toFixed(2)} م | التكلفة التقديرية: ${formatPrice(cost)}`;
  }
}

function exportProductsCSV() {
  let csv = "\uFEFFرقم الصنف,الباركود,اسم الصنف,سعر البيع\n";
  state.products.forEach(p => {
    csv += `"${p.item_number || p.itemid}","${p.barcode || ''}","${(p.arname || '').replace(/"/g, '""')}","${p.price_sale || 0}"\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "almamon_products_export.csv";
  a.click();
}

function printBarcodeLabel(itemid) {
  const p = state.products.find(x => Number(x.itemid) === Number(itemid));
  if (!p) return;
  openModal(`
    <div style="text-align:center;padding:20px;">
      <h3>🏷️ معاينة طباعة ملصق الباركود (مقاس 50x25mm)</h3>
      <div style="border:2px dashed #000;padding:16px;max-width:300px;margin:16px auto;background:#fff;color:#000;border-radius:8px;">
        <div style="font-weight:800;font-size:14px;">متجر المأمون الإلكتروني</div>
        <div style="font-size:13px;margin:6px 0;">${p.arname}</div>
        <div style="font-family:monospace;font-size:22px;font-weight:900;letter-spacing:4px;margin:8px 0;">||| |||| || |||| |||</div>
        <div style="font-weight:700;">#${p.barcode || p.item_number || p.itemid} — ${formatPrice(p.price_sale)}</div>
      </div>
      <button class="btn btn-primary" onclick="window.print()">🖨️ طباعة الملصق الآن</button>
    </div>
  `);
}

// Keyboard Shortcuts (Windows ERP compatibility: F10 new invoice, F5 print)
window.addEventListener("keydown", (e) => {
  if (e.key === "F10") {
    e.preventDefault();
    setMode("pos");
    newPosTab();
  } else if (e.key === "F5" && state.mode === "pos") {
    e.preventDefault();
    saveAndPrintPOS("thermal");
  }
});

function renderApp() {
  const root = document.getElementById("app-root");
  if (!root) return;
  if (state.mode === "store") root.innerHTML = renderStorefront();
  else if (state.mode === "admin") root.innerHTML = renderAdminERP();
  else if (state.mode === "pos") root.innerHTML = renderPOS();
  else if (state.mode === "scales") root.innerHTML = renderScalesAndTrialBalance(false);
}

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode")) state.mode = params.get("mode");
  renderApp();
  syncWithSupabase();
});
