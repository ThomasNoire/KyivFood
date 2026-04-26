(function () {
  const restaurants = window.KYIV_RESTAURANTS || [];
  const lists = window.KYIV_LISTS || [];
  const BROWSE_PAGE_SIZE = 3;
  const HEART_OUTLINE = "assets/img/heart-outline.png";
  const HEART_FILLED = "assets/img/heart-filled.png";
  let reviews = KyivFoodStorage.load();
  let browsePage = 1;
  let browseCuisineFilter = "all";
  let favoriteIds = new Set();
  let activeListId = null;
  let lastPickRestaurantId = null;
  let pickListenersBound = false;

  const els = {
    feed: document.getElementById("feed-list"),
    search: document.getElementById("global-search"),
    navHome: document.getElementById("nav-home"),
    navBrowse: document.getElementById("nav-browse"),
    navFavorites: document.getElementById("nav-favorites"),
    navPick: document.getElementById("nav-pick"),
    viewHome: document.getElementById("view-home"),
    viewBrowse: document.getElementById("view-browse"),
    viewFavorites: document.getElementById("view-favorites"),
    viewRestaurant: document.getElementById("view-restaurant"),
    restaurantDetail: document.getElementById("restaurant-detail"),
    browseGrid: document.getElementById("browse-grid"),
    browseCuisineWrap: document.getElementById("browse-cuisine-wrap"),
    browseLists: document.getElementById("browse-lists"),
    favoritesGrid: document.getElementById("favorites-grid"),
    browsePagination: document.getElementById("browse-pagination"),
    viewList: document.getElementById("view-list"),
    listDetail: document.getElementById("list-detail"),
    viewPick: document.getElementById("view-pick"),
    pickForm: document.getElementById("pick-form"),
    pickResult: document.getElementById("pick-result"),
    pickSurprise: document.getElementById("pick-surprise"),
    toast: document.getElementById("toast"),
  };

  function parseHash() {
    let raw = (location.hash || "#/").replace(/^#/, "");
    if (!raw) raw = "/";
    const qi = raw.indexOf("?");
    const pathPart = qi >= 0 ? raw.slice(0, qi) : raw;
    const searchPart = qi >= 0 ? raw.slice(qi + 1) : "";
    const params = new URLSearchParams(searchPart);
    const parts = pathPart.split("/").filter(Boolean);
    let fromSection = "browse";
    let listIdParam = "";
    const fromParam = params.get("from");
    if (fromParam === "diary") fromSection = "diary";
    else if (fromParam === "favorites") fromSection = "favorites";
    else if (fromParam === "list") {
      fromSection = "list";
      listIdParam = params.get("listId") || "";
    } else if (fromParam === "today") fromSection = "today";
    return {
      parts,
      fromSection,
      listIdParam,
    };
  }

  function getListById(id) {
    return lists.find(function (x) {
      return x.id === id;
    });
  }

  function isFavorite(restaurantId) {
    return favoriteIds.has(restaurantId);
  }

  function toggleFavorite(restaurantId) {
    if (favoriteIds.has(restaurantId)) favoriteIds.delete(restaurantId);
    else favoriteIds.add(restaurantId);
    KyivFoodFavorites.save(Array.from(favoriteIds));
  }

  function favToggleButtonHtml(restaurantId, isActive, extraClass) {
    const ec = extraClass ? " " + extraClass : "";
    const active = isActive ? " is-active" : "";
    const pressed = isActive ? "true" : "false";
    const label = isActive ? "Прибрати з обраного" : "Додати в обране";
    return (
      '<button type="button" class="fav-btn' +
      ec +
      active +
      '" data-fav-toggle="' +
      restaurantId +
      '" aria-pressed="' +
      pressed +
      '" aria-label="' +
      label +
      '">' +
      '<img src="' +
      HEART_OUTLINE +
      '" class="fav-btn__img fav-btn__img--off" width="32" height="32" alt="">' +
      '<img src="' +
      HEART_FILLED +
      '" class="fav-btn__img fav-btn__img--on" width="32" height="32" alt="">' +
      "</button>"
    );
  }

  function syncFavoriteUi() {
    if (!els.viewBrowse.hidden) renderBrowse(els.search.value);
    if (els.viewFavorites && !els.viewFavorites.hidden)
      renderFavorites(els.search.value);
    if (!els.viewRestaurant.hidden) {
      const p = parseHash().parts;
      if (p[0] === "restaurant" && p[1]) {
        renderRestaurant(p[1].split("?")[0]);
      }
    }
    if (els.viewList && !els.viewList.hidden && activeListId) {
      renderListPage(activeListId);
    }
    if (
      els.viewPick &&
      !els.viewPick.hidden &&
      lastPickRestaurantId &&
      byId(lastPickRestaurantId)
    ) {
      renderPickResult(byId(lastPickRestaurantId));
    }
  }

  function picsumUrl(id, salt) {
    return (
      "https://picsum.photos/seed/" +
      encodeURIComponent(String(id) + (salt || "")) +
      "/800/533"
    );
  }

  function restaurantImageUrl(r) {
    const p = r.photo && String(r.photo).trim();
    if (p) return p;
    return picsumUrl(r.id, "");
  }

  function restaurantImgOnError(r) {
    return "this.onerror=null;this.src='" + picsumUrl(r.id, "-alt") + "'";
  }

  function byId(id) {
    return restaurants.find((r) => r.id === id);
  }

  function saveReviews() {
    KyivFoodStorage.save(reviews);
  }

  function starsHtml(rating, interactive = false, extraClass = "") {
    const r = Number(rating) || 0;
    const full = Math.floor(r);
    const half = r - full >= 0.5 ? 1 : 0;
    const wrap = "stars" + (extraClass ? " " + extraClass : "");
    let html =
      '<span class="' +
      wrap +
      '" role="img" aria-label="' +
      r +
      ' з 5">';
    for (let i = 1; i <= 5; i++) {
      let cls = "star star--empty";
      if (i <= full) cls = "star star--full";
      else if (i === full + 1 && half) cls = "star star--half";
      const attrs = interactive
        ? ' data-value="' + i + '" tabindex="0" role="button"'
        : "";
      html +=
        "<span class=\"" +
        cls +
        "\"" +
        attrs +
        ">" +
        (interactive ? "★" : "") +
        "</span>";
    }
    html += "</span>";
    return html;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function reviewVenueScore(rev) {
    if (rev.venueRating != null && Number.isFinite(Number(rev.venueRating)))
      return Number(rev.venueRating);
    if (rev.rating != null && Number.isFinite(Number(rev.rating)))
      return Number(rev.rating);
    return null;
  }

  function reviewDishScore(rev) {
    if (rev.dishRating != null && Number.isFinite(Number(rev.dishRating)))
      return Number(rev.dishRating);
    return null;
  }

  function avgVenueRating(restaurantId) {
    const list = reviews.filter((x) => x.restaurantId === restaurantId);
    const vals = list.map(reviewVenueScore).filter((v) => v != null);
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round((sum / vals.length) * 10) / 10;
  }

  function avgDishRating(restaurantId) {
    const list = reviews.filter((x) => x.restaurantId === restaurantId);
    const vals = list.map(reviewDishScore).filter((v) => v != null);
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round((sum / vals.length) * 10) / 10;
  }

  /** Середня оцінка закладу (для карток каталогу тощо). */
  function avgRating(restaurantId) {
    return avgVenueRating(restaurantId);
  }

  function clampHalfRating(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 4;
    return Math.min(5, Math.max(1, Math.round(x * 2) / 2));
  }

  function formatRatingUk(n) {
    const s = String(n);
    return s.indexOf(".") >= 0 ? s.replace(".", ",") : s;
  }

  function halfRatingSelectOptions(selectedVal) {
    const sel = clampHalfRating(selectedVal);
    let html = "";
    for (let v = 5; v >= 1; v -= 0.5) {
      const isSel = Math.abs(v - sel) < 0.001;
      html +=
        '<option value="' +
        v +
        '"' +
        (isSel ? " selected" : "") +
        ">" +
        formatRatingUk(v) +
        " / 5</option>";
    }
    return html;
  }

  function restaurantPageHref(id, fromSection, listIdParam) {
    let href = "#/restaurant/" + id + "?from=" + fromSection;
    if (fromSection === "list" && listIdParam) {
      href += "&listId=" + encodeURIComponent(listIdParam);
    }
    return href;
  }

  function getSimilarRestaurants(current, limit) {
    const excludeId = current.id;
    const prof =
      typeof window.kyivFoodPickProfile === "function"
        ? window.kyivFoodPickProfile(current)
        : null;

    function scoreFor(x) {
      let score = 0;
      if (prof && window.kyivFoodPickProfile) {
        const px = window.kyivFoodPickProfile(x);
        if (px.district === prof.district) score += 3;
        prof.cuisineKeys.forEach(function (k) {
          if (px.cuisineKeys.has(k)) score += 6;
        });
      }
      const cu = (current.cuisine || "").toLowerCase();
      const xu = (x.cuisine || "").toLowerCase();
      const words = cu.split(/[\s\/,·|()—-]+/).filter(function (w) {
        return w.length > 3;
      });
      for (let i = 0; i < words.length; i++) {
        if (xu.includes(words[i])) score += 2;
      }
      return score;
    }

    const ranked = restaurants
      .filter(function (x) {
        return x.id !== excludeId;
      })
      .map(function (x) {
        return { x: x, s: scoreFor(x) };
      })
      .sort(function (a, b) {
        if (b.s !== a.s) return b.s - a.s;
        return a.x.name.localeCompare(b.x.name, "uk");
      });

    const out = [];
    const seen = new Set();
    for (let i = 0; i < ranked.length && out.length < limit; i++) {
      if (ranked[i].s <= 0) break;
      out.push(ranked[i].x);
      seen.add(ranked[i].x.id);
    }
    for (let j = 0; j < ranked.length && out.length < limit; j++) {
      if (seen.has(ranked[j].x.id)) continue;
      out.push(ranked[j].x);
      seen.add(ranked[j].x.id);
    }
    return out.slice(0, limit);
  }

  function similarRestaurantCard(r, fromSection, listIdParam) {
    const href = restaurantPageHref(r.id, fromSection, listIdParam);
    const imgSrc = restaurantImageUrl(r);
    const onErr = restaurantImgOnError(r);
    return (
      '<a class="rest-similar-card" href="' +
      href +
      '">' +
      '<div class="rest-similar-card__img"><img src="' +
      imgSrc +
      '" alt="" loading="lazy" decoding="async" onerror="' +
      onErr +
      '"></div>' +
      '<div class="rest-similar-card__body">' +
      '<span class="rest-similar-card__name">' +
      escapeHtml(r.name) +
      "</span>" +
      '<span class="rest-similar-card__meta">' +
      escapeHtml(r.cuisine) +
      "</span>" +
      "</div></a>"
    );
  }

  function similarRestaurantsSectionHtml(r, fromSection, listIdParam) {
    const sim = getSimilarRestaurants(r, 4);
    if (!sim.length) return "";
    return (
      '<section class="rest-similar" aria-labelledby="rest-similar-heading">' +
      '<h2 id="rest-similar-heading" class="section-title rest-similar__title">Схожі заклади</h2>' +
      '<p class="rest-similar__intro">Той самий район або схожа кухня — відкрийте профіль одним кліком.</p>' +
      '<div class="rest-similar__grid">' +
      sim
        .map(function (x) {
          return similarRestaurantCard(x, fromSection, listIdParam);
        })
        .join("") +
      "</div></section>"
    );
  }

  function restaurantCardArticle(r, fromSection, listIdForLink) {
    const avg = avgRating(r.id);
    const imgSrc = restaurantImageUrl(r);
    const onErr = restaurantImgOnError(r);
    const hasAvg = avg != null;
    const starBlock = starsHtml(
      hasAvg ? avg : 0,
      false,
      hasAvg ? "" : "stars--muted"
    );
    const scoreClass = "rest-card__score" + (hasAvg ? "" : " is-muted");
    const scoreText = hasAvg ? String(avg) : "—";
    const fav = isFavorite(r.id);
    const href = restaurantPageHref(r.id, fromSection, listIdForLink);
    return (
      '<article class="rest-card">' +
      favToggleButtonHtml(r.id, fav, "fav-btn--card") +
      '<a class="rest-card__link" href="' +
      href +
      '">' +
      '<div class="rest-card__img"><img src="' +
      imgSrc +
      '" alt="" loading="lazy" decoding="async" onerror="' +
      onErr +
      '"></div>' +
      '<div class="rest-card__info">' +
      "<h3>" +
      escapeHtml(r.name) +
      "</h3>" +
      "<p>" +
      escapeHtml(r.cuisine) +
      "</p>" +
      '<div class="rest-card__rating-row">' +
      starBlock +
      '<span class="' +
      scoreClass +
      '">' +
      scoreText +
      "</span>" +
      "</div>" +
      "</div></a></article>"
    );
  }

  function renderFavorites(filterText = "") {
    if (!els.favoritesGrid) return;
    const q = filterText.trim().toLowerCase();
    const favList = restaurants.filter(function (r) {
      return favoriteIds.has(r.id);
    });
    const filtered = favList.filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q)
    );
    if (!filtered.length) {
      els.favoritesGrid.innerHTML =
        '<p class="empty-state">' +
        (favList.length
          ? "Нічого не знайдено за вашим запитом."
          : "Ще немає обраних закладів. Натисніть сердечко у правому верхньому куті картки в каталозі ресторанів.") +
        "</p>";
      return;
    }
    els.favoritesGrid.innerHTML = filtered
      .map(function (r) {
        return restaurantCardArticle(r, "favorites");
      })
      .join("");
  }

  function renderBreadcrumbs(restaurantName, fromSection, listIdParam) {
    if (fromSection === "today") {
      return (
        '<nav class="breadcrumbs" aria-label="Шлях до сторінки">' +
        "<ol>" +
        '<li><a href="#/today">Куди сьогодні</a></li>' +
        '<li aria-current="page">' +
        escapeHtml(restaurantName) +
        "</li>" +
        "</ol></nav>"
      );
    }
    if (fromSection === "list" && listIdParam) {
      const L = getListById(listIdParam);
      const listTitle = L ? L.title : "Список";
      return (
        '<nav class="breadcrumbs" aria-label="Шлях до сторінки">' +
        "<ol>" +
        '<li><a href="#/">Ресторани</a></li>' +
        '<li><a href="#/list/' +
        encodeURIComponent(listIdParam) +
        '">' +
        escapeHtml(listTitle) +
        "</a></li>" +
        '<li aria-current="page">' +
        escapeHtml(restaurantName) +
        "</li>" +
        "</ol></nav>"
      );
    }
    let parentLabel = "Ресторани";
    let parentHref = "#/";
    if (fromSection === "diary") {
      parentLabel = "Щоденник";
      parentHref = "#/diary";
    } else if (fromSection === "favorites") {
      parentLabel = "Обране";
      parentHref = "#/favorites";
    }
    return (
      '<nav class="breadcrumbs" aria-label="Шлях до сторінки">' +
      "<ol>" +
      '<li><a href="' +
      parentHref +
      '">' +
      parentLabel +
      "</a></li>" +
      '<li aria-current="page">' +
      escapeHtml(restaurantName) +
      "</li>" +
      "</ol></nav>"
    );
  }

  function renderFeed(filterText = "") {
    const q = filterText.trim().toLowerCase();
    const sorted = [...reviews].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const filtered = sorted.filter((rev) => {
      const r = byId(rev.restaurantId);
      if (!r) return false;
      if (!q) return true;
      const dn = rev.dishName ? rev.dishName.toLowerCase() : "";
      return (
        r.name.toLowerCase().includes(q) ||
        dn.includes(q) ||
        (rev.body && rev.body.toLowerCase().includes(q))
      );
    });

    if (!filtered.length) {
      els.feed.innerHTML =
        '<p class="empty-state">Ще немає рев\'ю. Оберіть ресторан у каталозі та залиште перший запис.</p>';
      return;
    }

    els.feed.innerHTML = filtered
      .map((rev) => {
        const r = byId(rev.restaurantId);
        if (!r) return "";
        const imgSrc = restaurantImageUrl(r);
        const onErr = restaurantImgOnError(r);
        const vScore = reviewVenueScore(rev);
        const dScore = reviewDishScore(rev);
        const dishLine = rev.dishName
          ? '<p class="diary-card__dish">' + escapeHtml(rev.dishName) + "</p>"
          : "";
        const scoresHtml =
          '<div class="diary-card__scores">' +
          (dScore != null
            ? '<span class="diary-card__score-block"><span class="diary-card__score-label">Страва</span>' +
              starsHtml(dScore) +
              " <strong>" +
              formatRatingUk(dScore) +
              "</strong></span>"
            : "") +
          (vScore != null
            ? '<span class="diary-card__score-block"><span class="diary-card__score-label">Заклад</span>' +
              starsHtml(vScore) +
              " <strong>" +
              formatRatingUk(vScore) +
              "</strong></span>"
            : "") +
          "</div>";
        const again =
          typeof rev.wouldAgain === "boolean"
            ? '<span class="diary-card__again' +
              (rev.wouldAgain ? " is-yes" : " is-no") +
              '">' +
              (rev.wouldAgain ? "Знову: так" : "Знову: ні") +
              "</span>"
            : "";
        return (
          '<article class="diary-card">' +
          '<a href="#/restaurant/' +
          r.id +
          '?from=diary" class="diary-card__poster"><img src="' +
          imgSrc +
          '" alt="" loading="lazy" decoding="async" onerror="' +
          onErr +
          '"></a>' +
          '<div class="diary-card__body">' +
          '<header class="diary-card__head">' +
          '<a href="#/restaurant/' +
          r.id +
          '?from=diary" class="diary-card__title">' +
          escapeHtml(r.name) +
          "</a>" +
          "</header>" +
          dishLine +
          scoresHtml +
          '<p class="diary-card__meta">' +
          formatDate(rev.createdAt) +
          " · " +
          escapeHtml(r.cuisine) +
          (again ? " · " + again : "") +
          "</p>" +
          (rev.body
            ? '<p class="diary-card__text">' + escapeHtml(rev.body) + "</p>"
            : "") +
          "</div></article>"
        );
      })
      .join("");
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function loadBrowseCuisineFilter() {
    try {
      const saved = localStorage.getItem("kyivFoodBrowseCuisine");
      const opts = window.KYIV_CUISINE_FILTER_OPTIONS;
      if (
        saved &&
        opts &&
        opts.some(function (o) {
          return o.id === saved;
        })
      )
        browseCuisineFilter = saved;
    } catch (e) {
      browseCuisineFilter = "all";
    }
  }

  function matchesBrowseCuisine(r) {
    if (browseCuisineFilter === "all") return true;
    if (typeof window.kyivFoodCuisineGroups !== "function") return true;
    return window.kyivFoodCuisineGroups(r).has(browseCuisineFilter);
  }

  function renderBrowseCuisineStrip() {
    if (!els.browseCuisineWrap || !window.KYIV_CUISINE_FILTER_OPTIONS) return;
    const opts = window.KYIV_CUISINE_FILTER_OPTIONS;
    els.browseCuisineWrap.innerHTML =
      '<p class="browse-cuisine__label" id="browse-cuisine-label">Оберіть кухню</p>' +
      '<div class="browse-cuisine__chips" role="radiogroup" aria-labelledby="browse-cuisine-label">' +
      opts
        .map(function (o) {
          const active = browseCuisineFilter === o.id;
          return (
            '<button type="button" class="browse-cuisine__chip' +
            (active ? " is-active" : "") +
            '" data-cuisine="' +
            escapeHtml(o.id) +
            '" role="radio" aria-checked="' +
            (active ? "true" : "false") +
            '">' +
            escapeHtml(o.label) +
            "</button>"
          );
        })
        .join("") +
      "</div>";
  }

  function setBrowseCuisineFilter(id) {
    const opts = window.KYIV_CUISINE_FILTER_OPTIONS;
    if (!opts || !opts.some(function (o) { return o.id === id; })) return;
    browseCuisineFilter = id;
    try {
      localStorage.setItem("kyivFoodBrowseCuisine", id);
    } catch (e) {}
    browsePage = 1;
    renderBrowseCuisineStrip();
    renderBrowse(els.search.value);
  }

  function buildPageSequence(current, total) {
    if (total <= 1) return [];
    const set = new Set([1, total]);
    for (let p = current - 2; p <= current + 2; p++) {
      if (p >= 1 && p <= total) set.add(p);
    }
    const sorted = Array.from(set).sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const n of sorted) {
      if (prev && n - prev > 1) out.push(null);
      out.push(n);
      prev = n;
    }
    return out;
  }

  function restaurantMatchesBrowseQuery(r, q) {
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.cuisine.toLowerCase().includes(q) ||
      r.address.toLowerCase().includes(q)
    );
  }

  function renderBrowsePagination(totalItems, totalPages) {
    const nav = els.browsePagination;
    if (!nav) return;

    if (totalItems === 0 || totalPages <= 1) {
      nav.hidden = true;
      nav.innerHTML = "";
      return;
    }

    nav.hidden = false;
    const startIdx = (browsePage - 1) * BROWSE_PAGE_SIZE + 1;
    const endIdx = Math.min(browsePage * BROWSE_PAGE_SIZE, totalItems);
    const seq = buildPageSequence(browsePage, totalPages);

    let pagesHtml = "";
    for (const n of seq) {
      if (n === null) {
        pagesHtml +=
          '<span class="pagination__ellipsis" aria-hidden="true">…</span>';
        continue;
      }
      const cls =
        n === browsePage
          ? "pagination__num is-current"
          : "pagination__num";
      pagesHtml +=
        '<button type="button" class="' +
        cls +
        '" data-page="' +
        n +
        '"' +
        (n === browsePage ? ' aria-current="page"' : "") +
        ">" +
        n +
        "</button>";
    }

    nav.innerHTML =
      '<button type="button" data-page="prev"' +
      (browsePage <= 1 ? " disabled" : "") +
      ">Назад</button>" +
      '<span class="pagination__info">' +
      startIdx +
      "–" +
      endIdx +
      " з " +
      totalItems +
      "</span>" +
      '<div class="pagination__pages">' +
      pagesHtml +
      "</div>" +
      '<span class="pagination__info">Сторінка ' +
      browsePage +
      " з " +
      totalPages +
      "</span>" +
      '<button type="button" data-page="next"' +
      (browsePage >= totalPages ? " disabled" : "") +
      ">Далі</button>";
  }

  function renderBrowse(filterText = "") {
    const q = filterText.trim().toLowerCase();
    const list = restaurants.filter(
      (r) =>
        restaurantMatchesBrowseQuery(r, q) && matchesBrowseCuisine(r)
    );

    const totalItems = list.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / BROWSE_PAGE_SIZE));

    if (browsePage > totalPages) browsePage = totalPages;
    if (browsePage < 1) browsePage = 1;

    const start = (browsePage - 1) * BROWSE_PAGE_SIZE;
    const pageItems = list.slice(start, start + BROWSE_PAGE_SIZE);

    if (!pageItems.length) {
      els.browseGrid.innerHTML =
        '<p class="empty-state">Нічого не знайдено. Змініть фільтр кухні, пошук або оберіть «Усі заклади».</p>';
      renderBrowsePagination(0, 0);
      return;
    }

    els.browseGrid.innerHTML = pageItems
      .map((r) => {
        return restaurantCardArticle(r, "browse");
      })
      .join("");

    renderBrowsePagination(totalItems, totalPages);
  }

  function ukPlacesCountLabel(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return n + " заклад";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
      return n + " заклади";
    return n + " закладів";
  }

  function renderBrowseLists() {
    if (!els.browseLists) return;
    if (!lists.length) {
      els.browseLists.innerHTML = "";
      return;
    }
    els.browseLists.innerHTML = lists
      .map(function (list) {
        let coverR = null;
        for (let i = 0; i < list.restaurantIds.length; i++) {
          const r = byId(list.restaurantIds[i]);
          if (r) {
            coverR = r;
            break;
          }
        }
        const coverUrl = coverR
          ? restaurantImageUrl(coverR)
          : picsumUrl(list.id, "list-cover");
        const count = list.restaurantIds.filter(function (id) {
          return byId(id);
        }).length;
        const desc =
          list.description.length > 140
            ? list.description.slice(0, 137) + "…"
            : list.description;
        const coverSafe = coverUrl.replace(/'/g, "%27");
        return (
          '<a class="list-card" href="#/list/' +
          encodeURIComponent(list.id) +
          '">' +
          '<div class="list-card__cover" style="background-image:url(\'' +
          coverSafe +
          '\')"></div>' +
          '<div class="list-card__body">' +
          "<h3 class=\"list-card__title\">" +
          escapeHtml(list.title) +
          "</h3>" +
          '<p class="list-card__desc">' +
          escapeHtml(desc) +
          "</p>" +
          '<p class="list-card__meta">' +
          escapeHtml(ukPlacesCountLabel(count)) +
          "</p>" +
          "</div></a>"
        );
      })
      .join("");
  }

  function renderListPage(listId) {
    if (!els.listDetail) return;
    const L = getListById(listId);
    if (!L) {
      location.hash = "#/";
      return;
    }
    activeListId = listId;
    const q = els.search.value.trim().toLowerCase();
    const ordered = [];
    for (let i = 0; i < L.restaurantIds.length; i++) {
      const r = byId(L.restaurantIds[i]);
      if (!r) continue;
      if (!restaurantMatchesBrowseQuery(r, q)) continue;
      ordered.push(r);
    }

    const crumbs =
      '<nav class="breadcrumbs" aria-label="Шлях до сторінки">' +
      "<ol>" +
      '<li><a href="#/">Ресторани</a></li>' +
      '<li aria-current="page">' +
      escapeHtml(L.title) +
      "</li>" +
      "</ol></nav>";

    const gridHtml = ordered.length
      ? ordered
          .map(function (r) {
            return restaurantCardArticle(r, "list", L.id);
          })
          .join("")
      : '<p class="empty-state">Нічого не знайдено за вашим запитом у цій добірці.</p>';

    els.listDetail.innerHTML =
      crumbs +
      '<div class="page-head">' +
      "<h1>" +
      escapeHtml(L.title) +
      "</h1>" +
      '<p class="page-head__sub list-page__lead">' +
      escapeHtml(L.description) +
      "</p>" +
      "</div>" +
      '<div class="browse-grid">' +
      gridHtml +
      "</div>";
  }

  function onBrowsePaginationClick(e) {
    const btn = e.target.closest("[data-page]");
    if (!btn || !els.viewBrowse.contains(btn)) return;

    const q = els.search.value.trim().toLowerCase();
    const list = restaurants.filter(
      (r) =>
        restaurantMatchesBrowseQuery(r, q) && matchesBrowseCuisine(r)
    );
    const totalPages = Math.max(1, Math.ceil(list.length / BROWSE_PAGE_SIZE));

    const raw = btn.getAttribute("data-page");
    if (raw === "prev") browsePage -= 1;
    else if (raw === "next") browsePage += 1;
    else {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) browsePage = n;
    }
    browsePage = Math.min(totalPages, Math.max(1, browsePage));
    renderBrowse(els.search.value);
    window.scrollTo({ top: els.viewBrowse.offsetTop - 80, behavior: "smooth" });
  }

  function renderRestaurant(id) {
    const { fromSection, listIdParam } = parseHash();
    const r = byId(id);
    if (!r) {
      location.hash = "#/";
      return;
    }

    const avgVenue = avgVenueRating(r.id);
    const avgDish = avgDishRating(r.id);
    const list = reviews
      .filter((x) => x.restaurantId === id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const mapsUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(r.name + ", " + r.address + ", Київ");

    const imgSrc = restaurantImageUrl(r);
    const onErr = restaurantImgOnError(r);
    const crumbs = renderBreadcrumbs(r.name, fromSection, listIdParam);
    const favHero = favToggleButtonHtml(
      r.id,
      isFavorite(r.id),
      "fav-btn--hero"
    );

    els.restaurantDetail.innerHTML =
      crumbs +
      '<div class="rest-hero">' +
      favHero +
      '<div class="rest-hero__bg" style="background-image:url(' +
      imgSrc +
      ')"></div>' +
      '<div class="rest-hero__content">' +
      '<img class="rest-hero__poster" src="' +
      imgSrc +
      '" alt="" decoding="async" onerror="' +
      onErr +
      '">' +
      "<div>" +
      "<h1>" +
      escapeHtml(r.name) +
      "</h1>" +
      '<p class="rest-hero__sub">' +
      escapeHtml(r.cuisine) +
      " · " +
      escapeHtml(r.address) +
      "</p>" +
      (avgVenue != null || avgDish != null
        ? '<div class="rest-hero__avg-wrap">' +
          (avgDish != null
            ? '<p class="rest-hero__avg">' +
              starsHtml(avgDish) +
              " <span>страва в середньому " +
              formatRatingUk(avgDish) +
              "</span></p>"
            : "") +
          (avgVenue != null
            ? '<p class="rest-hero__avg' +
              (avgDish != null ? " rest-hero__avg--secondary" : "") +
              '">' +
              starsHtml(avgVenue) +
              " <span>заклад у середньому " +
              formatRatingUk(avgVenue) +
              "</span></p>"
            : "") +
          "</div>"
        : '<p class="rest-hero__avg muted">Ще немає оцінок — залиште перший запис про страву</p>') +
      "</div></div></div>" +
      '<div class="rest-layout">' +
      '<section class="rest-reviews">' +
      "<h2>Рев'ю</h2>" +
      '<form id="review-form" class="review-form">' +
      '<p class="review-form__lead">Оцініть окремо <strong>страву</strong> та <strong>заклад</strong> — так видно, де все топ, а де лише одна страва.</p>' +
      '<label class="review-form__label" for="review-dish-name">Страва</label>' +
      '<input type="text" id="review-dish-name" name="dishName" class="review-form__input" required maxlength="160" placeholder="Наприклад: курячий пян-се" autocomplete="off">' +
      '<label class="review-form__label" for="review-dish-rating">Оцінка страви</label>' +
      '<select id="review-dish-rating" name="dishRating" class="review-form__select" required>' +
      halfRatingSelectOptions(4.5) +
      "</select>" +
      '<label class="review-form__label" for="review-venue-rating">Оцінка закладу</label>' +
      '<select id="review-venue-rating" name="venueRating" class="review-form__select" required>' +
      halfRatingSelectOptions(4) +
      "</select>" +
      '<fieldset class="review-form__fieldset">' +
      '<legend class="review-form__label">Чи взяв би цю страву знову?</legend>' +
      '<div class="review-form__radios">' +
      '<label class="review-form__radio"><input type="radio" name="wouldAgain" value="yes" required> Так</label>' +
      '<label class="review-form__radio"><input type="radio" name="wouldAgain" value="no"> Ні</label>' +
      "</div></fieldset>" +
      '<label for="review-body" class="review-form__label">Коментар (необов\'язково)</label>' +
      '<textarea id="review-body" name="body" rows="4" placeholder="Атмосфера, сервіс, порада іншим гостям…" maxlength="2000"></textarea>' +
      '<button type="submit" class="btn btn--primary">Записати в щоденник</button>' +
      "</form>" +
      '<ul id="restaurant-reviews-list" class="reviews-list"></ul>' +
      "</section>" +
      '<aside class="rest-aside">' +
      '<a class="btn btn--ghost" target="_blank" rel="noopener" href="' +
      mapsUrl +
      '">Відкрити в Google Maps</a>' +
      "</aside>" +
      "</div>" +
      similarRestaurantsSectionHtml(r, fromSection, listIdParam);

    const listEl = document.getElementById("restaurant-reviews-list");
    if (list.length) {
      listEl.innerHTML = list
        .map(function (rev) {
          const v = reviewVenueScore(rev);
          const d = reviewDishScore(rev);
          const dishTitle = rev.dishName
            ? '<p class="review-item__dish">' + escapeHtml(rev.dishName) + "</p>"
            : "";
          const scores =
            '<div class="review-item__scores">' +
            (d != null
              ? '<span class="review-item__score"><span class="review-item__score-lbl">Страва</span> ' +
                starsHtml(d) +
                " <strong>" +
                formatRatingUk(d) +
                "</strong></span>"
              : "") +
            (v != null
              ? '<span class="review-item__score"><span class="review-item__score-lbl">Заклад</span> ' +
                starsHtml(v) +
                " <strong>" +
                formatRatingUk(v) +
                "</strong></span>"
              : "") +
            "</div>";
          const again =
            typeof rev.wouldAgain === "boolean"
              ? '<span class="review-item__again ' +
                (rev.wouldAgain ? "is-yes" : "is-no") +
                '">' +
                (rev.wouldAgain ? "Знову: так" : "Знову: ні") +
                "</span>"
              : "";
          return (
            "<li class=\"review-item\"><div class=\"review-item__top\">" +
            "<time>" +
            formatDate(rev.createdAt) +
            "</time>" +
            again +
            "</div>" +
            dishTitle +
            scores +
            (rev.body
              ? "<p>" + escapeHtml(rev.body) + "</p>"
              : "") +
            "</li>"
          );
        })
        .join("");
    } else {
      listEl.innerHTML =
        '<li class="review-item muted">Поки що немає рев\'ю — будьте першим.</li>';
    }

    document.getElementById("review-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const dishName = document.getElementById("review-dish-name").value.trim();
      if (dishName.length < 2) {
        showToast("Вкажіть назву страви (хоча б 2 символи)");
        return;
      }
      const dishRating = clampHalfRating(
        parseFloat(document.getElementById("review-dish-rating").value)
      );
      const venueRating = clampHalfRating(
        parseFloat(document.getElementById("review-venue-rating").value)
      );
      const againEl = document.querySelector(
        'input[name="wouldAgain"]:checked'
      );
      if (!againEl) {
        showToast("Оберіть: чи взяли б страву знову");
        return;
      }
      const wouldAgain = againEl.value === "yes";
      const body = document.getElementById("review-body").value.trim();
      reviews.push({
        id: "rev_" + Date.now(),
        restaurantId: r.id,
        dishName: dishName,
        dishRating: dishRating,
        venueRating: venueRating,
        wouldAgain: wouldAgain,
        rating: venueRating,
        body: body,
        createdAt: new Date().toISOString(),
      });
      saveReviews();
      showToast("Збережено у ваш щоденник");
      renderRestaurant(id);
      renderFeed(els.search.value);
      renderBrowse(els.search.value);
      renderFavorites(els.search.value);
    });
  }

  function readPickFiltersFromForm() {
    const fd = new FormData(els.pickForm);
    return {
      district: String(fd.get("pick-district") || "any"),
      budget: String(fd.get("pick-budget") || "any"),
      cuisine: String(fd.get("pick-cuisine") || "any"),
    };
  }

  function resetPickView() {
    lastPickRestaurantId = null;
    if (!els.pickResult) return;
    els.pickResult.hidden = true;
    els.pickResult.innerHTML = "";
    els.pickResult.classList.remove("is-empty");
  }

  function renderPickResult(r) {
    if (!els.pickResult || !r) return;
    const prof =
      typeof window.kyivFoodPickProfile === "function"
        ? window.kyivFoodPickProfile(r)
        : { district: "center", budget: "moderate", cuisineKeys: new Set() };
    const districtLabels = {
      podil: "Поділ",
      center: "Центр",
      obolon: "Оболонь",
      poznyaki: "Позняки · південь міста",
    };
    const budgetLabels = {
      economy: "Орієнтир до ~300 ₴",
      moderate: "Середній чек",
      splurge: "Особливий вечір",
    };
    const avg = avgRating(r.id);
    const hasAvg = avg != null;
    const imgSrc = restaurantImageUrl(r);
    const onErr = restaurantImgOnError(r);
    const fav = isFavorite(r.id);
    const detailHref = "#/restaurant/" + r.id + "?from=today";
    const mapsUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(r.name + ", " + r.address + ", Київ");

    els.pickResult.hidden = false;
    els.pickResult.classList.remove("is-empty");
    els.pickResult.innerHTML =
      '<div class="pick-result__inner">' +
      '<div class="pick-result__visual">' +
      '<span class="pick-result__badge">Ваш варіант</span>' +
      favToggleButtonHtml(r.id, fav, "fav-btn--hero pick-result__fav") +
      '<img src="' +
      imgSrc +
      '" alt="" decoding="async" onerror="' +
      onErr +
      '">' +
      "</div>" +
      '<div class="pick-result__body">' +
      '<div class="pick-result__chips">' +
      '<span class="pick-result__chip">' +
      escapeHtml(districtLabels[prof.district] || "Київ") +
      "</span>" +
      '<span class="pick-result__chip">' +
      escapeHtml(budgetLabels[prof.budget] || "") +
      "</span>" +
      "</div>" +
      "<h2>" +
      escapeHtml(r.name) +
      "</h2>" +
      '<p class="pick-result__meta">' +
      escapeHtml(r.cuisine) +
      " · " +
      escapeHtml(r.address) +
      "</p>" +
      (hasAvg
        ? '<p class="pick-result__avg">' +
          starsHtml(avg) +
          " <span>" +
          avg +
          " у щоденнику</span></p>"
        : '<p class="pick-result__avg muted">Ще без оцінок у щоденнику</p>') +
      '<div class="pick-result__actions">' +
      '<a class="btn btn--primary" href="' +
      detailHref +
      '">Сторінка закладу</a>' +
      '<a class="btn btn--ghost" target="_blank" rel="noopener" href="' +
      mapsUrl +
      '">Google Maps</a>' +
      '<button type="button" class="btn btn--ghost" id="pick-again">Ще раз</button>' +
      "</div>" +
      "</div></div>";
  }

  function runPick(surprise) {
    if (!els.pickForm || typeof window.kyivFoodPickMatches !== "function") return;
    const filters = surprise
      ? { district: "any", budget: "any", cuisine: "any" }
      : readPickFiltersFromForm();
    const pool = restaurants.filter(function (r) {
      return window.kyivFoodPickMatches(r, filters);
    });
    if (!pool.length) {
      lastPickRestaurantId = null;
      els.pickResult.hidden = false;
      els.pickResult.classList.add("is-empty");
      els.pickResult.innerHTML =
        '<p class="empty-state">За такими умовами нікого не знайшли. Спробуйте «Будь-який» у фільтрах або кнопку «Повна випадковість».</p>';
      return;
    }
    const r = pool[Math.floor(Math.random() * pool.length)];
    lastPickRestaurantId = r.id;
    renderPickResult(r);
    els.pickResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function bindPickPageOnce() {
    if (pickListenersBound || !els.pickForm) return;
    pickListenersBound = true;
    els.pickForm.addEventListener("submit", function (e) {
      e.preventDefault();
      runPick(false);
    });
    if (els.pickSurprise) {
      els.pickSurprise.addEventListener("click", function () {
        runPick(true);
      });
    }
    if (els.viewPick) {
      els.viewPick.addEventListener("click", function (e) {
        if (e.target.closest("#pick-again")) {
          e.preventDefault();
          runPick(false);
        }
      });
    }
  }

  function showView(name) {
    els.viewBrowse.hidden = name !== "browse";
    if (els.viewList) els.viewList.hidden = name !== "list";
    if (els.viewPick) els.viewPick.hidden = name !== "pick";
    if (els.viewFavorites) els.viewFavorites.hidden = name !== "favorites";
    els.viewHome.hidden = name !== "diary";
    els.viewRestaurant.hidden = name !== "restaurant";
    els.navBrowse.classList.toggle(
      "is-active",
      name === "browse" || name === "list"
    );
    if (els.navPick)
      els.navPick.classList.toggle("is-active", name === "pick");
    if (els.navFavorites)
      els.navFavorites.classList.toggle("is-active", name === "favorites");
    els.navHome.classList.toggle("is-active", name === "diary");
  }

  function route() {
    if (!location.hash || location.hash === "#") {
      history.replaceState(null, "", "#/");
    }

    activeListId = null;

    const { parts } = parseHash();

    if (parts[0] === "restaurant" && parts[1]) {
      const rid = parts[1].split("?")[0];
      showView("restaurant");
      renderRestaurant(rid);
      window.scrollTo(0, 0);
      return;
    }
    if (parts[0] === "diary") {
      showView("diary");
      renderFeed(els.search.value);
      window.scrollTo(0, 0);
      return;
    }
    if (parts[0] === "favorites") {
      showView("favorites");
      renderFavorites(els.search.value);
      window.scrollTo(0, 0);
      return;
    }
    if (parts[0] === "today") {
      showView("pick");
      resetPickView();
      bindPickPageOnce();
      window.scrollTo(0, 0);
      return;
    }
    if (parts[0] === "list" && parts[1]) {
      const lid = decodeURIComponent(parts[1].split("?")[0]);
      if (!getListById(lid)) {
        location.hash = "#/";
        return;
      }
      showView("list");
      renderListPage(lid);
      window.scrollTo(0, 0);
      return;
    }
    if (parts[0] === "browse") {
      showView("browse");
      renderBrowse(els.search.value);
      renderBrowseLists();
      window.scrollTo(0, 0);
      return;
    }
    showView("browse");
    renderBrowse(els.search.value);
    renderBrowseLists();
    window.scrollTo(0, 0);
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    els.toast.classList.add("is-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      els.toast.classList.remove("is-visible");
      els.toast.hidden = true;
    }, 2600);
  }

  window.initKyivFoodApp = function initKyivFoodApp() {
    if (window.__kyivFoodAppStarted) return;
    window.__kyivFoodAppStarted = true;
    reviews = KyivFoodStorage.load();
    favoriteIds = new Set(KyivFoodFavorites.load());

    els.search.addEventListener("input", () => {
      const v = els.search.value;
      browsePage = 1;
      if (!els.viewHome.hidden) renderFeed(v);
      if (!els.viewBrowse.hidden) renderBrowse(v);
      if (els.viewFavorites && !els.viewFavorites.hidden) renderFavorites(v);
      if (els.viewList && !els.viewList.hidden && activeListId)
        renderListPage(activeListId);
    });

    els.navHome.addEventListener("click", (e) => {
      e.preventDefault();
      location.hash = "#/diary";
    });
    els.navBrowse.addEventListener("click", (e) => {
      e.preventDefault();
      browsePage = 1;
      location.hash = "#/";
    });
    if (els.navFavorites) {
      els.navFavorites.addEventListener("click", (e) => {
        e.preventDefault();
        location.hash = "#/favorites";
      });
    }
    if (els.navPick) {
      els.navPick.addEventListener("click", (e) => {
        e.preventDefault();
        location.hash = "#/today";
      });
    }

    bindPickPageOnce();

    loadBrowseCuisineFilter();
    renderBrowseCuisineStrip();
    if (els.browseCuisineWrap) {
      els.browseCuisineWrap.addEventListener("click", function (e) {
        const btn = e.target.closest("[data-cuisine]");
        if (!btn) return;
        e.preventDefault();
        setBrowseCuisineFilter(btn.getAttribute("data-cuisine") || "all");
      });
    }

    els.viewBrowse.addEventListener("click", onBrowsePaginationClick);

    document.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-fav-toggle]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const rid = btn.getAttribute("data-fav-toggle");
      if (!rid || !byId(rid)) return;
      toggleFavorite(rid);
      syncFavoriteUi();
    });

    window.addEventListener("hashchange", route);
    route();
  };
})();
