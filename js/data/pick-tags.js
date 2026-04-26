/**
 * Евристики для «Куди сьогодні»: район, бюджет, теги кухні за адресою та описом.
 * Дані без точних координат — наближено, для гри та підказок.
 */
(function () {
  function inferDistrict(r) {
    const a = (r.address || "").toLowerCase();
    if (
      /андріївськ|нижній вал|веригина|хорива|воздвижен|набережно-хрещатицька|межигірськ|ікорська|житній|ричальна|спаська|фролівськ|лубков|назарівська|шевченка,\s*1\b/.test(
        a
      )
    )
      return "podil";
    if (/мічуріна|паркова дорога|труханів/.test(a)) return "obolon";
    const vn = /велика васильківська[^,]*,\s*(\d+)/i.exec(r.address || "");
    const n = vn ? parseInt(vn[1], 10) : NaN;
    if (!Number.isNaN(n) && n >= 48) return "poznyaky";
    const bn = /басейна[^,]*,\s*(\d+)/i.exec(r.address || "");
    const bnum = bn ? parseInt(bn[1], 10) : NaN;
    if (!Number.isNaN(bnum) && bnum >= 12) return "poznyaky";
    if (/соборності|ахматової/i.test(a)) return "poznyaky";
    return "center";
  }

  function inferBudget(r) {
    const t = (
      (r.cuisine || "") +
      " " +
      (r.name || "") +
      " " +
      (r.address || "")
    ).toLowerCase();
    if (
      /їдальня|шаурма|шаверма|кебаб|фалафель|хумус|піта|street|streat|фаст|hot-dog|corn dog|no\.?\s*1|варенична|пузата|корнер|wok|ролл|суши.?маркет|суші.?маркет|фуд.?корт/.test(
        t
      )
    )
      return "economy";
    if (
      /стейк|wine|beef meat|buddha|рік-стейк|rooftop|11 mirrors|шато|chateau|fine dining|авторськ|вино\b|michelin|мішлен/i.test(
        t
      )
    )
      return "splurge";
    return "moderate";
  }

  function inferCuisineKeys(r) {
    const t = (
      (r.cuisine || "") +
      " " +
      (r.name || "")
    ).toLowerCase();
    const keys = new Set();
    if (
      /піц|pizza|mafia|molino|napule|celentano|нью.?йорк|джонс|domino|доміно|папа|rim|римськ|il\s*forno|піцер/i.test(
        t
      )
    )
      keys.add("pizza");
    if (
      /суш|японськ|макі|сашім|ізакая|tanuki|isao|zuma|мосі|moshi|murakami|муракамі|євразія|васабі|sumosan|yoshi|акіра|ванабі|сушія|joly woo|kinza|mr\.?\s*zuma|фудзі|tokyo/i.test(
        t
      )
    )
      keys.add("sushi");
    if (/бургер|burger/.test(t)) keys.add("burgers");
    if (
      /кав'ярн|кавярн|coffee|espresso|blue cup|one love|first point|lviv croissant|croissant|milk bar|сніданк|benedict|чайко|латте|капучино|бариста|кофе|point coffee/i.test(
        t
      )
    )
      keys.add("coffee");
    if (
      /україн|канапа|панськ|корчма|варенич|останн|колиба|хата|традиційн|шпикач|остр|основа|круч|млин|печера|козац|бандура|котлет|спотикач|барикада|музафір|село\b/i.test(
        t
      )
    )
      keys.add("ukrainian");
    return keys;
  }

  window.kyivFoodPickProfile = function kyivFoodPickProfile(r) {
    return {
      district: inferDistrict(r),
      budget: inferBudget(r),
      cuisineKeys: inferCuisineKeys(r),
    };
  };

  /**
   * @param {object} filters — { district, budget, cuisine } (значення any — без фільтра)
   */
  window.kyivFoodPickMatches = function kyivFoodPickMatches(r, filters) {
    const p = window.kyivFoodPickProfile(r);
    if (filters.district !== "any" && p.district !== filters.district)
      return false;
    if (filters.budget === "budget300" && p.budget !== "economy")
      return false;
    if (
      filters.budget === "budget600" &&
      p.budget === "splurge"
    )
      return false;
    if (
      filters.cuisine !== "any" &&
      !p.cuisineKeys.has(filters.cuisine)
    )
      return false;
    return true;
  };
})();
