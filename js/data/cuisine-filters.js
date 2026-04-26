/**
 * Категорії кухні для каталогу «Ресторани» — збіг з полями cuisine/name у KYIV_RESTAURANTS.
 * Один заклад може мати кілька тегів (наприклад «гриль / бар»).
 */
(function () {
  window.KYIV_CUISINE_FILTER_OPTIONS = [
    { id: "all", label: "Усі заклади" },
    { id: "ukrainian", label: "Українська та регіональна" },
    { id: "italian", label: "Італійська та піца" },
    { id: "georgian", label: "Грузинська" },
    { id: "japanese", label: "Японська та суші" },
    { id: "pan_asia", label: "Китай, Корея, Тай, В'єтнам, азійська" },
    { id: "indian", label: "Індійська" },
    { id: "middle_east", label: "Близький Схід і Туреччина" },
    { id: "burgers_bbq", label: "Бургери та BBQ" },
    { id: "grill_steak", label: "Стейки, гриль, риба" },
    { id: "european", label: "Європейська та світова" },
    { id: "cafe_sweets", label: "Кафе, сніданки, десерти" },
    { id: "bars_drinks", label: "Бари, паби, вино" },
    { id: "other", label: "Інше" },
  ];

  function cuisineParts(cuisineStr) {
    return (cuisineStr || "")
      .split(/[/|]/)
      .map(function (s) {
        return s.trim().toLowerCase();
      })
      .filter(Boolean);
  }

  /**
   * @returns {Set<string>} id категорій (без «all»)
   */
  window.kyivFoodCuisineGroups = function kyivFoodCuisineGroups(r) {
    const cuisineRaw = r.cuisine || "";
    const c = (cuisineRaw + " " + (r.name || "")).toLowerCase();
    const tags = new Set();

    if (
      /україн|украин|кримськ|кримско|їдальн|пузата|варенич|канапа|панськ|корчма|спотикач|музафір|барикада|сучасна\s+україн|настоянк|остання\s+круч|хвилька.*україн/i.test(
        c
      ) ||
      /паб\s*\/\s*україн/i.test(c)
    ) {
      tags.add("ukrainian");
    }

    if (/грузин|хінкал|супра|тіфліс|шоти|мама\s*манана/i.test(c)) {
      tags.add("georgian");
    }

    if (
      /італій|італьян|піц|pizza|molino|napule|mafia|rimsk|остер|траттор|середземномор/i.test(
        c
      )
    ) {
      tags.add("italian");
    }

    if (
      /япон|суш|суші|izakaya|ізакая|tanuki|isao|zuma|мосі|moshi|murakami|муракамі|євразія|васабі|sumosan|yoshi|акіра|joly\s*woo|kinza|фудзі|tokyo|ванабі/i.test(
        c
      )
    ) {
      tags.add("japanese");
    }

    if (
      (/китай|корей|в'єтнам|вьетнам|тайськ|thai|азійськ|asian|wok|узбек|узбець|bao\b|china|viet|seoul|chi\b|mr\.?\s*zuma/i.test(
        c
      ) &&
        !/япон|суш|суші|izakaya/i.test(c)) ||
      /узбецька\s*\/\s*азійськ/i.test(c)
    ) {
      tags.add("pan_asia");
    }

    if (/індій|індий|curry|каррі|india|taj mahal/i.test(c)) {
      tags.add("indian");
    }

    if (
      /близькосхід|ливан|ліван|ізраїл|israel|турец|турецьк|kebab|кебаб|шаверма|хумус|humus|фалафель|falafel|піта|pita|israeli|leban/i.test(
        c
      )
    ) {
      tags.add("middle_east");
    }

    if (/бургер|burger|(^|[^a-z])bbq([^a-z]|$)|hot[\s-]?dog|corn\s*dog/i.test(c)) {
      tags.add("burgers_bbq");
    }

    if (
      /стейк|steak|бразиль|brazil|кавказ|кавказька|риба|морепродукт|seafood|grill\s*do/i.test(
        c
      ) ||
      /гриль/i.test(c)
    ) {
      tags.add("grill_steak");
    }

    if (
      /європей|european|француз|french|іспан|spanish|німець|german|австр|austria|британ|british|грец|greek|єврей|jewish|авторськ|здоров|вегетар|vegetarian|гастромаркет|мексикан|mexican|кубин|cuban|emigrante|très|tres\s+fr|bavaria|b-hotel|goodwine\s*kitchen/i.test(
        c
      )
    ) {
      tags.add("european");
    }

    if (
      /кав'ярн|кавярн|coffee|сніданк|breakfast|десерт|випічк|кондитер|milk\s*bar|benedict/i.test(
        c
      ) ||
      /(^|[\s|/])кафе([\s|/]|$)/i.test(c)
    ) {
      tags.add("cafe_sweets");
    }

    if (
      /(^|[\s|/])бар([\s|/]|$)|\bbar\b|паб|pub|коктейл|cocktail|спікі|speakeasy|винний|(^|[\s|/])вино([\s|/]|$)|wine\b|крафт|craft|ірланд|irish|гастробар|gastrobar|ресторан\s*\/\s*бар|алхімік|alchemist|loggerhead|pravda|the\s+pub|bel\s+modjo|red\s+line|deja\s*vu|havana/i.test(
        c
      ) ||
      /азійськ\w*\s*\/\s*бар/i.test(c)
    ) {
      tags.add("bars_drinks");
    }

    cuisineParts(cuisineRaw).forEach(function (tok) {
      if (tok === "бар" || tok === "паб" || tok === "вино") tags.add("bars_drinks");
      if (tok === "кафе") tags.add("cafe_sweets");
      if (tok === "кав'ярня" || tok === "кавярня") tags.add("cafe_sweets");
      if (tok === "сніданки" || tok === "випічка" || tok === "кондитерська")
        tags.add("cafe_sweets");
      if (/^десерти/i.test(tok)) tags.add("cafe_sweets");
      if (tok === "їдальня") tags.add("ukrainian");
      if (
        /коктейль|спікі|винний\s+бар|крафт|ірландський паб|гастробар/i.test(
          tok
        )
      )
        tags.add("bars_drinks");
    });

    if (tags.size === 0) {
      tags.add("other");
    }

    return tags;
  };
})();
