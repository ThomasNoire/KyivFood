(function () {
  const KEY = "kyivfood_reviews_v1";
  const FAV_KEY = "kyivfood_favorites_v1";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function save(reviews) {
    localStorage.setItem(KEY, JSON.stringify(reviews));
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (x) {
        return typeof x === "string" && x.length > 0;
      });
    } catch {
      return [];
    }
  }

  function saveFavorites(ids) {
    const unique = [];
    const seen = Object.create(null);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (!id || seen[id]) continue;
      seen[id] = true;
      unique.push(id);
    }
    localStorage.setItem(FAV_KEY, JSON.stringify(unique));
  }

  window.KyivFoodStorage = { load, save, KEY };
  window.KyivFoodFavorites = {
    load: loadFavorites,
    save: saveFavorites,
    KEY: FAV_KEY,
  };
})();
