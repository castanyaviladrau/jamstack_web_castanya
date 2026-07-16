document.addEventListener("DOMContentLoaded", () => {
  const cookieConsentStorageKey = "castanya-cookie-consent";
  const getCookieConsent = () => {
    try {
      return window.localStorage.getItem(cookieConsentStorageKey);
    } catch (error) {
      return null;
    }
  };

  const setCookieConsent = (value) => {
    try {
      window.localStorage.setItem(cookieConsentStorageKey, value);
    } catch (error) {
      // Ignore storage failures and still update the session UI.
    }

    document.dispatchEvent(
      new CustomEvent("cookie-consent:updated", {
        detail: { value },
      }),
    );
  };

  const header = document.querySelector(".site-header");
  const heroImg = document.querySelector(".hero-img");
  const hasClimbHeader = document.body.classList.contains("home");

  const mobileMenuBreakpoint = 980;

  const handleScroll = () => {
    if (!header) {
      return;
    }

    if (window.innerWidth <= mobileMenuBreakpoint) {
      header.classList.add("is-scrolled");
      document.documentElement.style.setProperty("--climb-progress", "1");
      return;
    }

    if (!hasClimbHeader) {
      // On internal pages, we just ensure the scrolled class is present for styling
      header.classList.add("is-scrolled");
      document.documentElement.style.setProperty("--climb-progress", "1");
      return;
    }

    const scrollPos = window.scrollY;
    const vh = window.innerHeight;
    const navHeight = 65; // Height of your menu bar

    // Calculate 0 to 1 progress based on scroll
    const dockingDistance = vh - navHeight;
    let progress = Math.min(scrollPos / dockingDistance, 1);

    // Send progress to CSS
    document.documentElement.style.setProperty("--climb-progress", progress);

    // Toggle solid color when it reaches the very top
    if (progress >= 1) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }

    // Optional: Fade out the background image slightly
    if (heroImg) {
      heroImg.style.opacity = Math.max(1 - scrollPos / vh, 0);
    }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll(); // Run immediately on load

  // --- CAROUSEL LOGIC ---
  const scrollContainer = document.getElementById("galleryScroll");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (scrollContainer && prevBtn && nextBtn) {
    // Determine how far to scroll (the width of one item + gap)
    const getScrollStep = () => {
      const firstItem = scrollContainer.querySelector(".gallery-item");
      if (!firstItem) return 300; // Fallback

      const itemWidth = firstItem.offsetWidth;
      const gap = 20; // Matches the gap in your CSS
      return itemWidth + gap;
    };

    nextBtn.addEventListener("click", () => {
      scrollContainer.scrollBy({
        left: getScrollStep(),
        behavior: "smooth",
      });
    });

    prevBtn.addEventListener("click", () => {
      scrollContainer.scrollBy({
        left: -getScrollStep(),
        behavior: "smooth",
      });
    });

    // Optional: Hide/Show arrows based on scroll position
    const toggleArrows = () => {
      const scrollLeft = scrollContainer.scrollLeft;
      const maxScroll =
        scrollContainer.scrollWidth - scrollContainer.clientWidth;

      // Subtle fade for the buttons at the ends
      prevBtn.style.opacity = scrollLeft <= 5 ? "0.3" : "1";
      prevBtn.style.pointerEvents = scrollLeft <= 5 ? "none" : "auto";

      nextBtn.style.opacity = scrollLeft >= maxScroll - 5 ? "0.3" : "1";
      nextBtn.style.pointerEvents =
        scrollLeft >= maxScroll - 5 ? "none" : "auto";
    };

    scrollContainer.addEventListener("scroll", toggleArrows);
    // Initialize arrow state
    toggleArrows();
  }

  const setupCarousel = (
    scrollId,
    prevId,
    nextId,
    cardSelector = ".gallery-item",
  ) => {
    const container = document.getElementById(scrollId);
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);

    if (container && prev && next) {
      const getStep = () => {
        const firstCard = container.querySelector(cardSelector);

        if (!firstCard) {
          return 340;
        }

        const nextCard = firstCard.nextElementSibling;
        if (!nextCard) {
          return firstCard.getBoundingClientRect().width;
        }

        return nextCard.offsetLeft - firstCard.offsetLeft;
      };

      next.addEventListener("click", () =>
        container.scrollBy({ left: getStep(), behavior: "smooth" }),
      );
      prev.addEventListener("click", () =>
        container.scrollBy({ left: -getStep(), behavior: "smooth" }),
      );
    }
  };

  const setupProfessionalsRecipeCarousel = (scrollId, prevId, nextId) => {
    const container = document.getElementById(scrollId);
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);

    if (!container || !prev || !next) {
      return;
    }

    const getStep = () => {
      return container.clientWidth;
    };

    const toggleButtons = () => {
      const maxScroll = container.scrollWidth - container.clientWidth;
      const atStart = container.scrollLeft <= 5;
      const atEnd = container.scrollLeft >= maxScroll - 5;

      prev.style.opacity = atStart ? "0.45" : "1";
      prev.disabled = atStart;
      next.style.opacity = atEnd ? "0.45" : "1";
      next.disabled = atEnd;
    };

    prev.addEventListener("click", () => {
      container.scrollBy({ left: -getStep(), behavior: "smooth" });
    });

    next.addEventListener("click", () => {
      container.scrollBy({ left: getStep(), behavior: "smooth" });
    });

    container.addEventListener("scroll", toggleButtons, { passive: true });
    window.addEventListener("resize", toggleButtons);
    toggleButtons();
  };

  const setupShopCatalogFiltering = () => {
    const products = Array.from(document.querySelectorAll("[data-shop-product]"));
    const filterLinks = Array.from(
      document.querySelectorAll("[data-shop-filter-link]"),
    );
    const title = document.querySelector("[data-shop-catalog-title]");
    const status = document.querySelector("[data-shop-catalog-status]");
    const reset = document.querySelector("[data-shop-filter-reset]");

    if (!products.length) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const activeFilters = {
      category: params.get("category"),
      moment: params.get("moment"),
      diet: params.get("diet"),
    };
    const activeEntries = Object.entries(activeFilters).filter(
      ([, value]) => Boolean(value),
    );
    const labelsByTypeAndValue = new Map(
      filterLinks.map((link) => [
        `${link.dataset.shopFilterType}:${link.dataset.shopFilterValue}`,
        link.dataset.shopFilterLabel,
      ]),
    );

    const getTokens = (value = "") => value.split(/\s+/).filter(Boolean);

    const productMatches = (product) => {
      const productMoments = getTokens(product.dataset.shopProductMoments);
      const productDiets = getTokens(product.dataset.shopProductDiets);

      return activeEntries.every(([type, value]) => {
        if (type === "category") {
          return product.dataset.shopProductCategory === value;
        }

        if (type === "moment") {
          return productMoments.includes(value);
        }

        if (type === "diet") {
          return productDiets.includes(value);
        }

        return true;
      });
    };

    let visibleCount = 0;
    products.forEach((product) => {
      const isVisible = productMatches(product);
      product.hidden = !isVisible;

      if (isVisible) {
        visibleCount += 1;
      }
    });

    filterLinks.forEach((link) => {
      const isActive = activeEntries.some(
        ([type, value]) =>
          link.dataset.shopFilterType === type &&
          link.dataset.shopFilterValue === value,
      );

      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    const activeLabels = activeEntries
      .map(([type, value]) => labelsByTypeAndValue.get(`${type}:${value}`))
      .filter(Boolean);

    if (title) {
      title.textContent = activeLabels.length
        ? activeLabels.join(" · ").toLocaleUpperCase("ca-ES")
        : "TOTS ELS PRODUCTES";
    }

    if (status) {
      const productLabel = visibleCount === 1 ? "producte" : "productes";
      status.textContent = activeLabels.length
        ? `${visibleCount} ${productLabel} trobats per ${activeLabels.join(" · ")}.`
        : "Explora tota la col·lecció o tria un filtre.";
    }

    if (reset) {
      reset.hidden = !activeLabels.length;
    }
  };

  const setupNewsFiltering = () => {
    const filterBar = document.querySelector("[data-news-filter-bar]");
    const grid = document.querySelector("[data-news-grid]");

    if (!filterBar || !grid) {
      return;
    }

    const cards = Array.from(grid.querySelectorAll("[data-news-card]"));
    const featured = document.querySelector("[data-news-featured]");
    const status = document.querySelector("[data-news-filter-status]");
    const reset = document.querySelector("[data-news-filter-reset]");
    const emptyMessage = document.querySelector("[data-news-filter-empty]");

    if (!cards.length) {
      return;
    }

    const groups = Array.from(
      filterBar.querySelectorAll("[data-news-filter-menu]"),
    ).map((menu) => ({
      menu,
      type: menu.dataset.newsFilterType,
      summaryLabel: menu.querySelector("[data-news-filter-summary-label]"),
      defaultLabel:
        menu.querySelector("[data-news-filter-summary]")?.dataset.defaultLabel ||
        "",
      options: Array.from(menu.querySelectorAll("[data-news-filter-option]")),
    }));

    const defaultFilters = {
      sort: "newest",
      topic: "",
      type: "",
      readingTime: "",
    };
    const filters = { ...defaultFilters };
    const labelsByType = new Map();

    groups.forEach((group) => {
      const labels = new Map(
        group.options.map((option) => [
          option.dataset.newsFilterValue,
          option.dataset.newsFilterLabel || option.textContent.trim(),
        ]),
      );
      labelsByType.set(group.type, labels);
    });

    const params = new URLSearchParams(window.location.search);
    groups.forEach((group) => {
      const value = params.get(group.type);
      if (value && labelsByType.get(group.type)?.has(value)) {
        filters[group.type] = value;
      }
    });

    const getTokens = (value = "") => value.split(/\s+/).filter(Boolean);
    const getMinutes = (value = "") => Number.parseInt(value, 10) || 0;
    const getDateValue = (card) => {
      const value = new Date(card.dataset.newsDate || "").getTime();
      return Number.isFinite(value) ? value : 0;
    };

    const readingTimeMatches = (minutes, range) => {
      if (!range) {
        return true;
      }
      if (range === "short") {
        return minutes < 3;
      }
      if (range === "medium") {
        return minutes >= 3 && minutes <= 5;
      }
      if (range === "long") {
        return minutes > 5;
      }
      return true;
    };

    const cardMatches = (card) => {
      if (filters.topic) {
        const topics = getTokens(card.dataset.newsTopics);
        if (!topics.includes(filters.topic)) {
          return false;
        }
      }

      if (filters.type && card.dataset.newsType !== filters.type) {
        return false;
      }

      return readingTimeMatches(
        getMinutes(card.dataset.newsReadingTime),
        filters.readingTime,
      );
    };

    const hasActiveFilters = () =>
      Boolean(filters.topic || filters.type || filters.readingTime) ||
      filters.sort !== defaultFilters.sort;

    const updateUrl = () => {
      const url = new URL(window.location.href);
      Object.entries(filters).forEach(([type, value]) => {
        if (value && value !== defaultFilters[type]) {
          url.searchParams.set(type, value);
        } else {
          url.searchParams.delete(type);
        }
      });
      window.history.replaceState({}, "", url);
    };

    const updateControls = () => {
      groups.forEach((group) => {
        const value = filters[group.type] || "";
        const label = labelsByType.get(group.type)?.get(value);
        const isDefaultSort = group.type === "sort" && value === defaultFilters.sort;

        if (group.summaryLabel) {
          group.summaryLabel.textContent = label && !isDefaultSort ? label : group.defaultLabel;
        }

        group.options.forEach((option) => {
          const isActive = option.dataset.newsFilterValue === value;
          if (isActive) {
            option.setAttribute("aria-current", "true");
          } else {
            option.removeAttribute("aria-current");
          }
        });
      });
    };

    const getActiveLabels = () =>
      groups
        .map((group) => {
          const value = filters[group.type];
          if (!value || (group.type === "sort" && value === defaultFilters.sort)) {
            return null;
          }
          return labelsByType.get(group.type)?.get(value);
        })
        .filter(Boolean);

    const render = (options = {}) => {
      const defaultView = !hasActiveFilters();
      const matchedCards = cards.filter(cardMatches).sort((a, b) => {
        const direction = filters.sort === "oldest" ? 1 : -1;
        return (getDateValue(a) - getDateValue(b)) * direction;
      });

      if (featured) {
        featured.hidden = !defaultView;
      }

      cards.forEach((card) => {
        card.hidden = true;
      });

      matchedCards.forEach((card) => {
        const isFeaturedDuplicate = card.hasAttribute(
          "data-news-featured-duplicate",
        );
        card.hidden = defaultView && isFeaturedDuplicate;
        grid.appendChild(card);
      });

      const activeLabels = getActiveLabels();
      const newsLabel = matchedCards.length === 1 ? "notícia" : "notícies";
      const foundLabel = matchedCards.length === 1 ? "trobada" : "trobades";

      if (status) {
        status.textContent = activeLabels.length
          ? `${matchedCards.length} ${newsLabel} ${foundLabel} per ${activeLabels.join(" · ")}.`
          : "Explora totes les notícies o tria un filtre.";
      }

      if (reset) {
        reset.hidden = !hasActiveFilters();
      }

      if (emptyMessage) {
        emptyMessage.hidden = matchedCards.length !== 0;
      }

      updateControls();

      if (options.updateUrl) {
        updateUrl();
      }
    };

    groups.forEach((group) => {
      group.options.forEach((option) => {
        option.addEventListener("click", () => {
          filters[group.type] = option.dataset.newsFilterValue || "";
          group.menu.removeAttribute("open");
          render({ updateUrl: true });
        });
      });
    });

    reset?.addEventListener("click", () => {
      Object.assign(filters, defaultFilters);
      render({ updateUrl: true });
    });

    render();
  };

  const setupRecipeResultsFilter = () => {
    const form = document.querySelector("[data-recipe-filter-form]");

    if (!form) {
      return;
    }

    // The results page carries a results grid and filters cards live; the
    // recipes index reuses the same dropdown menus (shop-page-filter-menu
    // style) just to build the query string for its normal GET navigation.
    const grid = document.querySelector("[data-recipe-results-grid]");
    const cards = grid ? Array.from(grid.querySelectorAll("[data-recipe-card]")) : [];
    const status = document.querySelector("[data-recipe-results-status]");
    const resetBtn = document.querySelector("[data-recipe-results-reset]");
    const emptyMessage = document.querySelector("[data-recipe-results-empty]");

    const groups = Array.from(
      form.querySelectorAll("[data-recipe-filter-menu]"),
    ).map((menu) => ({
      menu,
      key: menu.dataset.recipeFilterMenu,
      input: menu.querySelector("[data-recipe-filter-input]"),
      summaryLabel: menu.querySelector("[data-recipe-filter-summary-label]"),
      defaultLabel:
        menu.querySelector("[data-recipe-filter-summary]")?.dataset
          .defaultLabel || "",
      options: Array.from(menu.querySelectorAll("[data-recipe-filter-option]")),
    }));

    if (!groups.length) {
      return;
    }

    const getFilters = () => {
      const filters = {};
      groups.forEach((group) => {
        if (group.input && group.input.value) {
          filters[group.key] = group.input.value;
        }
      });
      return filters;
    };

    const cardMatches = (card, filters) => {
      if (filters.difficulty && card.dataset.difficulty !== filters.difficulty) {
        return false;
      }
      if (filters.time && card.dataset.time !== filters.time) {
        return false;
      }
      if (filters.dishType) {
        const dishTypes = (card.dataset.dishType || "").split(" ");
        if (!dishTypes.includes(filters.dishType)) {
          return false;
        }
      }
      return true;
    };

    const updateUrl = (filters) => {
      const url = new URL(window.location.href);
      groups.forEach(({ key }) => {
        if (filters[key]) {
          url.searchParams.set(key, filters[key]);
        } else {
          url.searchParams.delete(key);
        }
      });
      window.history.replaceState({}, "", url);
    };

    const applyFilters = (options = {}) => {
      const filters = getFilters();

      if (grid) {
        const hasFilters = Object.keys(filters).length > 0;
        let visibleCount = 0;

        cards.forEach((card) => {
          const isVisible = cardMatches(card, filters);
          card.hidden = !isVisible;
          if (isVisible) {
            visibleCount += 1;
          }
        });

        if (status) {
          const recipeLabel = visibleCount === 1 ? "recepta" : "receptes";
          status.textContent = hasFilters
            ? `${visibleCount} ${recipeLabel} trobades amb aquests filtres.`
            : "Explora totes les receptes o afina la cerca amb els filtres.";
        }

        if (resetBtn) {
          resetBtn.hidden = !hasFilters;
        }

        if (emptyMessage) {
          emptyMessage.hidden = visibleCount !== 0;
        }
      }

      if (options.updateUrl && grid) {
        updateUrl(filters);
      }
    };

    const setGroupValue = (group, value, label) => {
      if (group.input) {
        group.input.value = value || "";
      }

      group.options.forEach((option) => {
        const isActive = (option.dataset.recipeFilterValue || "") === (value || "");
        option.setAttribute("aria-current", isActive ? "true" : "false");
      });

      if (group.summaryLabel) {
        group.summaryLabel.textContent = value ? label : group.defaultLabel;
      }

      group.menu.removeAttribute("open");
    };

    groups.forEach((group) => {
      group.options.forEach((option) => {
        option.addEventListener("click", () => {
          const value = option.dataset.recipeFilterValue || "";
          const label = option.dataset.recipeFilterLabel || option.textContent.trim();
          setGroupValue(group, value, label);
          applyFilters({ updateUrl: true });
        });
      });
    });

    form.addEventListener("submit", (event) => {
      if (grid) {
        event.preventDefault();
        applyFilters({ updateUrl: true });
      }
      // On pages without a results grid (the recipes index), let the form
      // submit normally: it's a real GET to /gastronomic/receptes/resultats/
      // carrying whatever hidden filter values were just set above.
    });

    resetBtn?.addEventListener("click", () => {
      groups.forEach((group) => setGroupValue(group, "", ""));
      applyFilters({ updateUrl: true });
    });

    if (grid) {
      const params = new URLSearchParams(window.location.search);
      groups.forEach((group) => {
        const value = params.get(group.key);
        const matchedOption = group.options.find(
          (option) => option.dataset.recipeFilterValue === value,
        );
        if (value && matchedOption) {
          setGroupValue(group, value, matchedOption.dataset.recipeFilterLabel);
        }
      });
    }

    applyFilters();
  };

  // Initialize all carousels
  setupCarousel("galleryScroll", "prevBtn", "nextBtn");
  setupCarousel(
    "shopCategoriesCarousel",
    "shopCategoriesPrev",
    "shopCategoriesNext",
  );
  setupCarousel("shopFeaturedCarousel", "shopFeaturedPrev", "shopFeaturedNext");
  setupCarousel("shopGiftsCarousel", "shopGiftsPrev", "shopGiftsNext");
  setupShopCatalogFiltering();
  setupNewsFiltering();
  setupRecipeResultsFilter();
  setupCarousel(
    "testimonialScroll",
    "prevTestimonial",
    "nextTestimonial",
    ".review-card",
  );
  setupCarousel(
    "visitActivityReviewsScroll",
    "visitActivityReviewsPrev",
    "visitActivityReviewsNext",
  );
  setupProfessionalsRecipeCarousel(
    "professionalsFoundationsCarousel",
    "professionalsFoundationsPrev",
    "professionalsFoundationsNext",
  );
  setupProfessionalsRecipeCarousel(
    "professionalsRecipesCarousel",
    "professionalsRecipesPrev",
    "professionalsRecipesNext",
  );
  setupProfessionalsRecipeCarousel(
    "professionalsAuthorCarousel",
    "professionalsAuthorPrev",
    "professionalsAuthorNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicRecipesCarousel",
    "gastronomicRecipesPrev",
    "gastronomicRecipesNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicHomeCarousel",
    "gastronomicHomePrev",
    "gastronomicHomeNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicClassicsCarousel",
    "gastronomicClassicsPrev",
    "gastronomicClassicsNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicHealthyCarousel",
    "gastronomicHealthyPrev",
    "gastronomicHealthyNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicSweetCarousel",
    "gastronomicSweetPrev",
    "gastronomicSweetNext",
  );
  setupProfessionalsRecipeCarousel(
    "gastronomicRemediesCarousel",
    "gastronomicRemediesPrev",
    "gastronomicRemediesNext",
  );
  const setupHeaderDropdown = () => {
    const nav = document.querySelector(".header-nav");
    const menuToggle = document.querySelector(".header-menu-toggle");
    const navLinks = document.querySelectorAll(".header-nav a");
    const dropdownItems = Array.from(
      document.querySelectorAll(".nav-item--dropdown"),
    );

    if (!nav || !menuToggle || !dropdownItems.length) {
      return;
    }

    const isMobileNavigation = () => window.innerWidth <= mobileMenuBreakpoint;

    const closeDropdown = (item) => {
      const button = item.querySelector(".nav-link-button");
      item.classList.remove("is-open");

      if (button) {
        button.setAttribute("aria-expanded", "false");
      }
    };

    const closeAllDropdowns = () => {
      dropdownItems.forEach(closeDropdown);
    };

    const closeMenu = () => {
      if (!isMobileNavigation()) {
        return;
      }

      header?.classList.remove("is-menu-open");
      nav.hidden = true;
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Obrir menu principal");
      document.body.classList.remove("has-mobile-menu-open");
      closeAllDropdowns();
    };

    const openMenu = () => {
      if (!isMobileNavigation()) {
        return;
      }

      nav.hidden = false;
      header?.classList.add("is-menu-open");
      menuToggle.setAttribute("aria-expanded", "true");
      menuToggle.setAttribute("aria-label", "Tancar menu principal");
      document.body.classList.add("has-mobile-menu-open");
    };

    const openDropdown = (item) => {
      dropdownItems.forEach((dropdownItem) => {
        if (dropdownItem !== item) {
          closeDropdown(dropdownItem);
        }
      });

      const button = item.querySelector(".nav-link-button");
      item.classList.add("is-open");

      if (button) {
        button.setAttribute("aria-expanded", "true");
      }
    };

    if (isMobileNavigation()) {
      nav.hidden = true;
    }

    menuToggle.addEventListener("click", () => {
      if (!isMobileNavigation()) {
        return;
      }

      const isOpen = header?.classList.contains("is-menu-open");

      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    dropdownItems.forEach((dropdownItem) => {
      const trigger = dropdownItem.querySelector(".nav-link-button");

      if (!trigger) {
        return;
      }

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = dropdownItem.classList.contains("is-open");

        if (isOpen) {
          closeDropdown(dropdownItem);
        } else {
          openDropdown(dropdownItem);
        }
      });
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (isMobileNavigation()) {
          closeMenu();
        }
      });
    });

    document.addEventListener("click", (event) => {
      dropdownItems.forEach((dropdownItem) => {
        if (!dropdownItem.contains(event.target)) {
          closeDropdown(dropdownItem);
        }
      });

      if (
        isMobileNavigation() &&
        header?.classList.contains("is-menu-open") &&
        !header.contains(event.target)
      ) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAllDropdowns();
        closeMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (isMobileNavigation()) {
        if (!header?.classList.contains("is-menu-open")) {
          nav.hidden = true;
        }
        return;
      }

      nav.hidden = false;
      header?.classList.remove("is-menu-open");
      document.body.classList.remove("has-mobile-menu-open");
      closeAllDropdowns();
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Obrir menu principal");
    });
  };

  const setupProfessionalsValueFeature = () => {
    const prev = document.getElementById("professionalsValuePrev");
    const next = document.getElementById("professionalsValueNext");
    const content = document.getElementById("professionalsValueContent");
    const eyebrow = document.getElementById("professionalsValueEyebrow");
    const intro = document.getElementById("professionalsValueIntro");
    const icon = document.getElementById("professionalsValueIcon");
    const title = document.getElementById("professionalsValueTitle");
    const text = document.getElementById("professionalsValueText");

    if (
      !prev ||
      !next ||
      !content ||
      !eyebrow ||
      !intro ||
      !icon ||
      !title ||
      !text
    ) {
      return;
    }

    const slides = [
      {
        eyebrow: "EL NOSTRE VALOR AFEGIT: MES QUE UN INGREDIENT, UN PROJECTE",
        intro:
          "En triar la Castanya de Viladrau com el seu proveidor de confianca, el seu establiment s'uneix a un projecte amb anima.",
        title: "RECUPERACIO DE BOSCOS",
        text: "Treballem activament en la neteja i revitalitzacio de les boscuries del Parc Natural del Montseny, recuperant castanyers centenaris que havien estat abandonats.",
        icon: `<svg width="137" height="118" viewBox="0 0 137 118" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M59.2998 0.644531C61.5117 0.516411 63.7237 0.473874 65.9355 0.514648H65.9375C72.355 0.602187 78.7053 1.53732 84.7129 3.2793V3.28027C91.0508 5.19102 96.1357 8.47913 99.2803 12.7656L99.4238 12.9619L99.668 12.9697C107.712 13.2245 115.791 13.9366 122.463 16.7969V16.7959C130.057 20.0656 135.726 26.1315 135.726 33.916C135.726 41.4573 130.406 47.385 123.158 50.7207L122.451 51.0352C115.934 53.8403 108.203 55.0393 100.38 55.3281L100.076 55.3398L99.9463 55.6152C97.9741 59.7981 95.0701 63.4751 91.8145 67.0498C90.1867 68.8371 88.4777 70.5919 86.7559 72.3721C85.2513 73.9276 83.738 75.5012 82.2715 77.123L81.6455 77.8213C74.1276 86.2871 67.6133 96.1923 67.6133 113.021C67.6132 114.007 67.108 114.987 66.1445 115.733C65.178 116.482 63.8449 116.916 62.4365 116.916H51.085C49.6766 116.916 48.3435 116.482 47.377 115.733C46.4136 114.987 45.9083 114.007 45.9082 113.021C45.9082 103.886 48.2783 96.7082 51.9072 90.8633L52.1865 90.4131L51.7207 90.1602C45.7283 86.8975 39.8818 83.2739 34.9795 78.6338C28.8089 72.7965 24.3801 65.3002 23.4062 55.6377L23.3643 55.2217L22.9482 55.1885C17.3613 54.7437 12.5006 53.5426 8.55469 51.3223H8.55371C3.41672 48.4132 0.5 43.5961 0.5 38.3105C0.500016 32.9747 3.62092 28.17 8.80176 25.29C12.7742 23.0859 18.2154 22.6305 23.8105 22.1885L24.1865 22.1582L24.2617 21.7891C25.4935 15.7235 29.1301 10.4926 34.8633 7.17188C41.7551 3.18073 50.4579 1.19639 59.3008 0.645508L59.2998 0.644531ZM33.7871 55.9502C34.7347 63.7519 38.1866 69.1979 43.0674 73.7969C46.9055 77.4357 51.7858 80.5273 57.1318 83.4863L57.4678 83.6719L57.7334 83.3965C60.0278 81.019 62.5445 78.7727 65.2627 76.6768L65.6719 76.3613L65.3428 75.9629C61.3326 71.1109 58.2378 64.3942 57.4521 55.8438L57.4102 55.3896H33.7188L33.7871 55.9502ZM67.8438 55.9463C68.5342 62.005 70.561 66.7404 72.9219 70.1992L73.2188 70.6338L73.6367 70.3154C75.4967 68.9047 77.2971 67.4767 79.0361 66.0303L79.0576 66.0127L79.0762 65.9922C82.2067 62.7341 85.3559 59.358 87.5615 56.1738L88.1055 55.3896H67.7803L67.8438 55.9463Z" fill="#EEE9DF" stroke="#EEE9DF"/>
</svg>
`,
      },
      {
        eyebrow:
          "ATRIBUTS QUE FAN DE LA NOSTRA CASTANYA UN INGREDIENT CLAU A LA CUINA",
        intro:
          "El nostre producte destaca en el paladar professional per tres caracteristiques clau derivades del seu origen.",
        title: "COMPROMIS SOSTENIBLE",
        text: "Som un projecte de Km 0 que aposta per l'economia circular i la preservacio del territori. Servir les nostres castanyes es explicar una historia de respecte per la natura als seus clients.",
        icon: `<svg width="137" height="118" viewBox="0 0 137 118" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M93.4045 104.696C85.5034 107.934 76.8611 109.606 68.1122 109.588C35.5637 109.588 9.08174 86.7625 9.08174 58.7082C9.08174 46.6731 13.8814 35.3074 22.7042 26.1921V35.2252H31.7858V11.7422H4.54093V19.5699H17.4459C6.18733 30.2927 -0.0324442 44.2463 0.000127282 58.7082C0.000127282 91.0795 30.5552 117.416 68.1122 117.416C78.2121 117.434 88.1885 115.503 97.3096 111.764L93.4045 104.696Z" fill="#EEE9DF"/>
<path d="M90.8154 31.3105C76.4665 31.3105 64.7013 40.9268 63.6705 53.0715C58.6785 49.1453 52.1652 46.9679 45.4074 46.9659H27.2441V62.6212C27.2441 75.5721 39.468 86.1042 54.489 86.1042H63.5706V101.76H72.6522V70.4489H81.7338C96.7548 70.4489 108.979 59.9167 108.979 46.9659V31.3105H90.8154ZM54.489 78.2765C44.472 78.2765 36.3258 71.2551 36.3258 62.6212V54.7935H45.4074C55.4244 54.7935 63.5706 61.815 63.5706 70.4489V72.7424L53.1585 63.768L46.7378 69.3021L57.1499 78.2765H54.489ZM99.897 46.9659C99.897 55.5998 91.7508 62.6212 81.7338 62.6212H79.0729L89.485 53.6468L83.0643 48.1126L72.6522 57.0871V54.7935C72.6522 46.1596 80.7984 39.1382 90.8154 39.1382H99.897V46.9659Z" fill="#EEE9DF"/>
<path d="M136.226 58.7076C136.226 26.3363 105.671 0.000126404 68.1139 0.000126404C58.014 -0.0179976 48.0376 1.91309 38.9165 5.6517L42.8216 12.7201C50.7227 9.48177 59.365 7.81008 68.1139 7.82779C100.662 7.82779 127.144 30.6533 127.144 58.7076C127.144 70.7427 122.345 82.1084 113.522 91.2237V82.1906H104.44V105.674H131.685V97.8459H118.78C130.039 87.1231 136.259 73.1695 136.226 58.7076Z" fill="#EEE9DF"/>
</svg>
`,
      },
      {
        eyebrow:
          "ATRIBUTS QUE FAN DE LA NOSTRA CASTANYA UN INGREDIENT CLAU A LA CUINA",
        intro:
          "El nostre producte destaca en el paladar professional per tres caracteristiques clau derivades del seu origen.",
        title: "TRIATGE I SELECCIO MANUAL",
        text: "El nostre valor diferencial es el factor huma. Revisem cada fruit per garantir que nomes el millor calibre i estat arribi a la seva cuina.",
        icon: `<svg width="137" height="118" viewBox="0 0 137 118" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M69.3234 0C69.3234 0 32.6948 13.0176 32.6948 29.0734C32.6948 45.1313 49.0922 58.1468 69.3234 58.1468C89.5522 58.1468 105.952 45.1313 105.952 29.0734C105.952 13.0176 69.3234 0 69.3234 0ZM69.3234 53.6058C55.6903 53.6058 49.0784 50.3603 44.1873 41.7951C52.7144 46.1696 58.065 47.7531 69.3234 47.7531C80.5794 47.7531 85.9799 46.1686 94.5083 41.7951C89.6196 50.3603 82.9566 53.6058 69.3234 53.6058Z" fill="#EEE9DF"/>
<path d="M131.099 82.3921C129.518 81.3564 127.676 80.6457 125.719 80.3153C123.761 79.9849 121.74 80.0438 119.814 80.4875L93.7005 85.5927C94.5565 83.6612 94.8489 81.582 94.5526 79.5333C94.2564 77.4846 93.3802 75.5276 91.9994 73.8301C90.6186 72.1326 88.7742 70.7452 86.6245 69.787C84.4747 68.8287 82.0838 68.3281 79.6567 68.3282H50.7609C48.486 68.3227 46.2324 68.7012 44.1309 69.4419C42.0293 70.1826 40.1215 71.2707 38.518 72.6431L25.1207 84.0366H8.08111C5.93787 84.0366 3.8824 84.7606 2.3669 86.0495C0.8514 87.3383 0 89.0863 0 90.909V110.544C0 112.367 0.8514 114.115 2.3669 115.404C3.8824 116.693 5.93787 117.417 8.08111 117.417H68.1122C68.3963 117.417 68.6794 117.387 68.9549 117.329L105.897 109.474C106.072 109.435 106.244 109.386 106.411 109.327L128.819 101.218L129.009 101.144C130.99 100.303 132.687 99.0461 133.94 97.4929C135.192 95.9396 135.959 94.1409 136.168 92.2659C136.377 90.391 136.021 88.5017 135.134 86.776C134.247 85.0503 132.859 83.545 131.099 82.4019V82.3921ZM6.92667 110.544V90.909C6.92667 90.6486 7.04829 90.3989 7.26479 90.2148C7.48129 90.0307 7.77493 89.9272 8.08111 89.9272H23.0889V111.526H8.08111C7.77493 111.526 7.48129 111.423 7.26479 111.239C7.04829 111.055 6.92667 110.805 6.92667 110.544ZM125.996 95.8179L103.946 103.805L67.6851 111.526H30.0155V88.2042L43.4129 76.8058C44.3756 75.9828 45.5208 75.3303 46.7821 74.8862C48.0434 74.4422 49.3958 74.2153 50.7609 74.2188H79.6567C81.7999 74.2188 83.8553 74.9429 85.3708 76.2317C86.8864 77.5205 87.7378 79.2686 87.7378 81.0912C87.7378 82.9139 86.8864 84.662 85.3708 85.9508C83.8553 87.2396 81.7999 87.9637 79.6567 87.9637H63.4944C62.5759 87.9637 61.695 88.274 61.0455 88.8263C60.396 89.3787 60.0311 90.1278 60.0311 90.909C60.0311 91.6901 60.396 92.4393 61.0455 92.9917C61.695 93.544 62.5759 93.8543 63.4944 93.8543H81.9655C82.2258 93.8546 82.4853 93.8299 82.739 93.7807L121.413 86.2161L121.551 86.1867C123.007 85.8492 124.558 85.981 125.906 86.5567C127.255 87.1324 128.305 88.1115 128.856 89.3059C129.408 90.5003 129.42 91.8257 128.892 93.0277C128.365 94.2296 127.333 95.2233 125.996 95.8179Z" fill="#EEE9DF"/>
</svg>
`,
      },
    ];

    let currentIndex = 0;

    const renderSlide = (index, direction = "next") => {
      const slide = slides[index];
      const exitClass =
        direction === "prev" ? "is-switching-left" : "is-switching-right";
      const enterClass =
        direction === "prev" ? "is-entering-left" : "is-entering-right";

      content.classList.remove(
        "is-switching",
        "is-switching-left",
        "is-switching-right",
        "is-entering",
        "is-entering-left",
        "is-entering-right",
      );
      content.classList.add("is-switching", exitClass);

      window.setTimeout(() => {
        eyebrow.textContent = slide.eyebrow;
        intro.textContent = slide.intro;
        title.textContent = slide.title;
        text.textContent = slide.text;
        icon.innerHTML = slide.icon;
        content.classList.remove("is-switching", exitClass);
        content.classList.add("is-entering", enterClass);

        window.requestAnimationFrame(() => {
          content.classList.remove(enterClass);
        });

        window.setTimeout(() => {
          content.classList.remove("is-entering");
        }, 220);
      }, 180);
    };

    prev.addEventListener("click", () => {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      renderSlide(currentIndex, "prev");
    });

    next.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % slides.length;
      renderSlide(currentIndex, "next");
    });
  };

  const setupProjecteFireTextSlider = () => {
    const prev = document.getElementById("projecteFirePrev");
    const next = document.getElementById("projecteFireNext");
    const content = document.getElementById("projecteFireContent");
    const textWrap = content?.querySelector(".projecte-feature__text");
    const title = document.getElementById("projecteFireTitle");
    const copy = document.getElementById("projecteFireCopy");
    const slideNodes = content?.querySelectorAll(".projecte-feature__slide");

    if (
      !prev ||
      !next ||
      !content ||
      !textWrap ||
      !title ||
      !copy ||
      !slideNodes?.length
    ) {
      return;
    }

    const slides = Array.from(slideNodes)
      .map((node) => ({
        title: node.querySelector("h2")?.textContent?.trim() || "",
        copy: node.querySelector("p")?.textContent?.trim() || "",
      }))
      .filter((slide) => slide.title || slide.copy);

    if (slides.length <= 1) {
      prev.style.display = "none";
      next.style.display = "none";
      return;
    }

    let currentIndex = 0;

    const renderSlide = (index, direction = "next") => {
      const slide = slides[index];
      const exitClass =
        direction === "prev" ? "is-switching-left" : "is-switching-right";
      const enterClass =
        direction === "prev" ? "is-entering-left" : "is-entering-right";

      textWrap.classList.remove(
        "is-switching",
        "is-switching-left",
        "is-switching-right",
        "is-entering",
        "is-entering-left",
        "is-entering-right",
      );
      textWrap.classList.add("is-switching", exitClass);

      window.setTimeout(() => {
        title.textContent = slide.title;
        copy.textContent = slide.copy;
        textWrap.classList.remove("is-switching", exitClass);
        textWrap.classList.add("is-entering", enterClass);

        window.requestAnimationFrame(() => {
          textWrap.classList.remove(enterClass);
        });

        window.setTimeout(() => {
          textWrap.classList.remove("is-entering");
        }, 220);
      }, 180);
    };

    prev.addEventListener("click", () => {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      renderSlide(currentIndex, "prev");
    });

    next.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % slides.length;
      renderSlide(currentIndex, "next");
    });
  };

  const setupContactForm = () => {
    const form = document.getElementById("contactForm");
    const status = document.getElementById("contactFormStatus");

    if (!form || !status) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      const preferredTime = formData.get("preferredTime");
      const business = formData.get("business");
      const visibleMessage = formData.get("message");
      const composedMessage =
        visibleMessage ||
        [
          "Sol.licitud de contacte professional.",
          preferredTime ? `Horari preferit: ${preferredTime}` : "",
          business ? `Negoci o projecte: ${business}` : "",
        ]
          .filter(Boolean)
          .join("\n");

      const payload = {
        type: "contact",
        data: {
          name: formData.get("name") || "Consulta web",
          email: formData.get("email") || "info@castanyadeviladrau.cat",
          phone: formData.get("phone"),
          business,
          message: composedMessage,
        },
      };

      submitButton.disabled = true;
      status.textContent = "Enviant consulta...";

      try {
        const response = await fetch("/.netlify/functions/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Request failed");
        }

        form.reset();
        status.textContent =
          "Consulta enviada correctament. En Joaquim et respondra al mes aviat possible.";
      } catch (error) {
        status.textContent =
          "No hem pogut enviar la consulta ara mateix. Torna-ho a provar en uns minuts.";
      } finally {
        submitButton.disabled = false;
      }
    });
  };

  const setupVisitBooking = () => {
    const modal = document.querySelector("[data-booking-modal]");
    const triggers = document.querySelectorAll("[data-booking-trigger]");
    const form = document.querySelector("[data-booking-form]");
    const status = document.querySelector("[data-booking-status]");

    if (!modal || !triggers.length || !form || !status) {
      return;
    }

    const dialog = modal.querySelector(".visit-booking-modal__dialog");
    const nameInput = form.querySelector('input[name="name"]');
    const closeControlSelector = "[data-booking-close]";
    const focusableSelector =
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    let previousActiveElement = null;

    const getFocusableElements = () =>
      Array.from(dialog.querySelectorAll(focusableSelector)).filter(
        (element) => !element.disabled,
      );

    const openModal = () => {
      previousActiveElement = document.activeElement;
      modal.hidden = false;
      document.body.classList.add("has-visit-booking-modal");

      window.requestAnimationFrame(() => {
        modal.classList.add("is-visible");
        nameInput?.focus();
      });
    };

    const closeModal = () => {
      modal.classList.remove("is-visible");
      document.body.classList.remove("has-visit-booking-modal");

      window.setTimeout(() => {
        modal.hidden = true;
        previousActiveElement?.focus?.();
      }, 180);
    };

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", openModal);
    });

    modal.addEventListener("click", (event) => {
      if (event.target.closest(closeControlSelector)) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (modal.hidden) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      const payload = {
        type: "activity-booking",
        to: formData.get("email"),
        data: {
          activityTitle: formData.get("activityTitle"),
          activityUrl: formData.get("activityUrl"),
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          preferredDate: formData.get("preferredDate"),
          partySize: formData.get("partySize"),
          message: formData.get("message"),
        },
      };

      submitButton.disabled = true;
      status.textContent = "Enviant solicitud...";

      try {
        const response = await fetch("/.netlify/functions/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Request failed");
        }

        form.reset();
        status.textContent =
          "Solicitud enviada correctament. Rebras un correu de confirmacio en breu.";
      } catch (error) {
        status.textContent =
          "No hem pogut enviar la solicitud ara mateix. Torna-ho a provar en uns minuts.";
      } finally {
        submitButton.disabled = false;
      }
    });
  };

  const setupVisitExperienceModals = () => {
    const triggers = Array.from(
      document.querySelectorAll("[data-experience-trigger]"),
    );
    const modals = Array.from(
      document.querySelectorAll("[data-experience-modal]"),
    );

    if (!triggers.length || !modals.length) {
      return;
    }

    const focusableSelector =
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    let activeModal = null;
    let previousActiveElement = null;

    const getFocusableElements = (modal) => {
      const dialog = modal.querySelector(".visit-experience-modal__dialog");

      return Array.from(dialog.querySelectorAll(focusableSelector)).filter(
        (element) => !element.disabled,
      );
    };

    const closeModal = () => {
      if (!activeModal) {
        return;
      }

      const modal = activeModal;
      activeModal = null;
      modal.classList.remove("is-visible");
      document.body.classList.remove("has-visit-experience-modal");

      window.setTimeout(() => {
        modal.hidden = true;
        previousActiveElement?.focus?.();
        previousActiveElement = null;
      }, 180);
    };

    const openModal = (trigger) => {
      const modalId = trigger.getAttribute("aria-controls");
      const modal = modalId ? document.getElementById(modalId) : null;

      if (!modal) {
        return;
      }

      if (activeModal) {
        closeModal();
      }

      previousActiveElement = trigger;
      activeModal = modal;
      modal.hidden = false;
      document.body.classList.add("has-visit-experience-modal");

      window.requestAnimationFrame(() => {
        modal.classList.add("is-visible");
        modal.querySelector("[data-experience-close]")?.focus();
      });
    };

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => openModal(trigger));
    });

    modals.forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target.closest("[data-experience-close]")) {
          closeModal();
        }
      });
    });

    document.addEventListener("keydown", (event) => {
      if (!activeModal) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(activeModal);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    });
  };

  const setupCookieBanner = () => {
    const banner = document.getElementById("cookieBanner");
    const reopenControls = document.querySelectorAll(
      "[data-cookie-preferences]",
    );

    if (!banner) {
      return;
    }

    const buttons = banner.querySelectorAll("[data-cookie-action]");

    const showBanner = () => {
      banner.hidden = false;
      document.body.classList.add("has-cookie-banner");

      window.requestAnimationFrame(() => {
        banner.classList.add("is-visible");
      });
    };

    const hideBanner = () => {
      banner.classList.remove("is-visible");
      document.body.classList.remove("has-cookie-banner");

      window.setTimeout(() => {
        banner.hidden = true;
      }, 220);
    };

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.cookieAction;

        setCookieConsent(action === "accept" ? "accepted" : "rejected");

        hideBanner();
      });
    });

    reopenControls.forEach((control) => {
      control.addEventListener("click", () => {
        showBanner();
      });
    });

    const storedPreference = getCookieConsent();

    if (storedPreference === "accepted" || storedPreference === "rejected") {
      return;
    }

    showBanner();
  };

  const setupConsentMaps = () => {
    const mapFrames = Array.from(
      document.querySelectorAll(".where-card__map-frame"),
    );

    const mapEmbeds = mapFrames
      .map((frame) => {
        const placeholder = frame.querySelector("[data-map-embed]");

        if (!placeholder) {
          return null;
        }

        return {
          frame,
          placeholderMarkup: placeholder.outerHTML,
          title: placeholder.dataset.mapTitle || "Mapa",
          src: placeholder.dataset.mapSrc || "",
        };
      })
      .filter(Boolean);

    if (!mapEmbeds.length) {
      return;
    }

    const renderMap = (mapEmbed) => {
      if (mapEmbed.frame.querySelector("iframe.where-card__map")) {
        return;
      }

      const iframe = document.createElement("iframe");
      iframe.className = "where-card__map";
      iframe.title = mapEmbed.title;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.src = mapEmbed.src;

      mapEmbed.frame.replaceChildren(iframe);
    };

    const attachPlaceholderAction = (mapEmbed) => {
      const placeholder = mapEmbed.frame.querySelector("[data-map-embed]");

      if (!placeholder) {
        return;
      }

      const acceptButton = placeholder.querySelector(
        '[data-map-action="accept"]',
      );

      if (!acceptButton) {
        return;
      }

      acceptButton.addEventListener("click", () => {
        setCookieConsent("accepted");
        renderMap(mapEmbed);
      });
    };

    const renderPlaceholder = (mapEmbed) => {
      mapEmbed.frame.innerHTML = mapEmbed.placeholderMarkup;
      attachPlaceholderAction(mapEmbed);
    };

    const applyConsentToMaps = (consentValue) => {
      if (consentValue === "accepted") {
        mapEmbeds.forEach(renderMap);
        return;
      }

      mapEmbeds.forEach(renderPlaceholder);
    };

    document.addEventListener("cookie-consent:updated", (event) => {
      applyConsentToMaps(event.detail?.value);
    });

    applyConsentToMaps(getCookieConsent());
  };

  const setupFustaShowcase = () => {
    const prev = document.getElementById("fustaShowcasePrev");
    const next = document.getElementById("fustaShowcaseNext");
    const heroImage = document.getElementById("fustaShowcaseHeroImage");
    const title = document.getElementById("fustaShowcaseTitle");
    const text = document.getElementById("fustaShowcaseText");
    const slideNodes = document.querySelectorAll(".fusta-showcase-slide-data");
    const slideSelectors = document.querySelectorAll("[data-fusta-showcase-slide]");

    if (
      !prev ||
      !next ||
      !heroImage ||
      !title ||
      !text ||
      !slideNodes.length
    ) {
      return;
    }

    const slides = Array.from(slideNodes).map((slide) => slide.dataset);
    let index = 0;

    const renderSlide = () => {
      const slide = slides[index];
      heroImage.src = slide.heroImage;
      heroImage.alt = slide.heroAlt;
      title.textContent = slide.title;
      slideSelectors.forEach((selector) => {
        const selectorIndex = Number.parseInt(
          selector.dataset.fustaShowcaseSlide,
          10,
        );
        selector.setAttribute("aria-pressed", String(selectorIndex === index));
      });
      text.textContent = slide.text;
    };

    slideSelectors.forEach((selector) => {
      selector.addEventListener("click", () => {
        const selectorIndex = Number.parseInt(
          selector.dataset.fustaShowcaseSlide,
          10,
        );

        if (Number.isNaN(selectorIndex) || !slides[selectorIndex]) {
          return;
        }

        index = selectorIndex;
        renderSlide();
      });
    });

    prev.addEventListener("click", () => {
      index = (index - 1 + slides.length) % slides.length;
      renderSlide();
    });

    next.addEventListener("click", () => {
      index = (index + 1) % slides.length;
      renderSlide();
    });

    renderSlide();
  };

  const setupCart = () => {
    const cartStorageKey = "castanya-cart";
    const checkoutStorageKey = "castanya-checkout-draft";
    const checkoutSessionKey = "castanya-checkout-session";
    const currency = "EUR";

    const clearCart = () => {
      try {
        window.localStorage.removeItem(cartStorageKey);
      } catch (error) {
        // Ignore storage failures.
      }
    };

    const formatMoney = (value) => {
      return new Intl.NumberFormat("ca-ES", {
        style: "currency",
        currency,
      }).format(Number(value) || 0);
    };

    const readCart = () => {
      try {
        const rawCart = window.localStorage.getItem(cartStorageKey);
        const parsed = rawCart ? JSON.parse(rawCart) : null;
        if (!parsed || !Array.isArray(parsed.items)) {
          return { items: [] };
        }

        const items = parsed.items.filter(
          (item) =>
            item &&
            item.sku &&
            item.productSlug &&
            item.variantLabel &&
            Number(item.quantity) > 0,
        );
        return { items };
      } catch (error) {
        return { items: [] };
      }
    };

    const writeCart = (cart) => {
      try {
        window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
      } catch (error) {
        // Ignore storage failures and keep UI responsive.
      }
    };

    const getCartCount = (cart) => {
      return cart.items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      );
    };

    const getCartSubtotal = (cart) => {
      return cart.items.reduce(
        (sum, item) =>
          sum + Number(item.unitPrice || 0) * Number(item.quantity || 0),
        0,
      );
    };

    const updateCartCount = () => {
      const count = getCartCount(readCart());
      const countNodes = document.querySelectorAll("[data-cart-count]");

      countNodes.forEach((node) => {
        node.textContent = String(count);
        node.hidden = count === 0;
      });
    };

    const saveCheckoutDraft = (draft) => {
      try {
        window.localStorage.setItem(checkoutStorageKey, JSON.stringify(draft));
      } catch (error) {
        // Ignore storage failures and keep UI responsive.
      }
    };

    const readCheckoutDraft = () => {
      try {
        const rawDraft = window.localStorage.getItem(checkoutStorageKey);
        return rawDraft ? JSON.parse(rawDraft) : {};
      } catch (error) {
        return {};
      }
    };

    const saveCheckoutSession = (session) => {
      try {
        window.localStorage.setItem(
          checkoutSessionKey,
          JSON.stringify(session),
        );
      } catch (error) {
        // Ignore storage failures and keep UI responsive.
      }
    };

    const readCheckoutSession = () => {
      try {
        const rawSession = window.localStorage.getItem(checkoutSessionKey);
        return rawSession ? JSON.parse(rawSession) : null;
      } catch (error) {
        return null;
      }
    };

    const clearCheckoutSession = () => {
      try {
        window.localStorage.removeItem(checkoutSessionKey);
      } catch (error) {
        // Ignore storage failures and keep UI responsive.
      }
    };

    const clearCheckoutDraft = () => {
      try {
        window.localStorage.removeItem(checkoutStorageKey);
      } catch (error) {
        // Ignore storage failures.
      }
    };

    const buildCartFingerprint = (cart) => {
      return cart.items
        .map(
          (item) =>
            `${String(item.sku || "").trim()}:${Number(item.quantity || 0)}`,
        )
        .sort()
        .join("|");
    };

    const normalizeCheckoutPayload = (payload) => {
      return {
        name: String(payload.name || "").trim(),
        email: String(payload.email || "")
          .trim()
          .toLowerCase(),
        phone: String(payload.phone || "").trim(),
        country: String(payload.country || "").trim(),
        address: String(payload.address || "").trim(),
        city: String(payload.city || "").trim(),
        postalCode: String(payload.postalCode || "").trim(),
        notes: String(payload.notes || "").trim(),
        isPickup: String(payload.isPickup || "").trim(),
        pickupStore: String(payload.pickupStore || "").trim(),
        paymentMethod: "card",
        acceptLegal: String(payload.acceptLegal || "").trim(),
        acceptPrivacy: String(payload.acceptPrivacy || "").trim(),
        acceptFulfillmentTerms: String(
          payload.acceptFulfillmentTerms || "",
        ).trim(),
        billingSameAsShipping: String(
          payload.billingSameAsShipping || "on",
        ).trim(),
        billingCompany: String(payload.billingCompany || "").trim(),
        billingVat: String(payload.billingVat || "").trim(),
        billingAddress: String(payload.billingAddress || "").trim(),
        billingCity: String(payload.billingCity || "").trim(),
        billingPostalCode: String(payload.billingPostalCode || "").trim(),
        billingCountry: String(payload.billingCountry || "").trim(),
      };
    };

    const isValidEmail = (value) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
    };

    const isValidInternationalPhone = (value) => {
      const phone = String(value || "").trim();
      if (!/^\+?[0-9\s().-]+$/.test(phone)) {
        return false;
      }

      const digits = phone.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) {
        return false;
      }

      const plusCount = (phone.match(/\+/g) || []).length;
      return plusCount === 0 || (plusCount === 1 && phone.startsWith("+"));
    };

    const getCheckoutValidationError = (payload) => {
      const requiredFields = [
        "name",
        "email",
        "phone",
        "country",
        "address",
        "city",
        "postalCode",
      ];
      const isPickup = payload.isPickup === "on";
      const missingField = requiredFields.find(
        (field) => !String(payload[field] || "").trim(),
      );

      if (missingField) {
        return {
          field: missingField,
          message: "Completa tots els camps obligatoris abans de continuar.",
        };
      }

      if (!isValidEmail(payload.email)) {
        return {
          field: "email",
          message: "Introdueix un correu electronic valid.",
        };
      }

      if (!isValidInternationalPhone(payload.phone)) {
        return {
          field: "phone",
          message:
            "Introdueix un telefon valid amb extensio internacional si cal.",
        };
      }

      if (isPickup && !String(payload.pickupStore || "").trim()) {
        return {
          field: "pickupStore",
          message: "Selecciona la botiga on vols recollir la comanda.",
        };
      }

      if (payload.acceptLegal !== "on") {
        return {
          field: "acceptLegal",
          message: "Has d'acceptar l'Avis legal per continuar.",
        };
      }

      if (payload.acceptPrivacy !== "on") {
        return {
          field: "acceptPrivacy",
          message: "Has d'acceptar la Politica de privacitat per continuar.",
        };
      }

      if (payload.acceptFulfillmentTerms !== "on") {
        return {
          field: "acceptFulfillmentTerms",
          message:
            "Has de confirmar que entens les condicions d'enviament i recollida.",
        };
      }

      return null;
    };

    const submitPaymentForm = (payment) => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = payment.redsysUrl;
      form.hidden = true;

      [
        ["Ds_SignatureVersion", payment.signatureVersion],
        ["Ds_MerchantParameters", payment.parameters],
        ["Ds_Signature", payment.signature],
      ].forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    };

    const createOrder = async ({ items, customer }) => {
      const response = await fetch("/.netlify/functions/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items, customer }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success || !data?.order?.id) {
        throw new Error(
          data?.details || data?.error || "No hem pogut crear la comanda.",
        );
      }

      return data.order;
    };

    const initiatePayment = async ({
      orderId,
      publicOrderCode,
      paymentMethod,
    }) => {
      const response = await fetch("/.netlify/functions/payment-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, publicOrderCode, paymentMethod }),
      });
      const data = await response.json().catch(() => ({}));

      return {
        ok: response.ok,
        status: response.status,
        data,
      };
    };

    const upsertCartItem = (nextItem) => {
      const cart = readCart();
      const existingItem = cart.items.find(
        (item) => item.sku && nextItem.sku && item.sku === nextItem.sku,
      );

      if (existingItem) {
        existingItem.quantity += nextItem.quantity;
      } else {
        cart.items.push(nextItem);
      }

      writeCart(cart);
      updateCartCount();
    };

    const bindProductActions = () => {
      const addButtons = document.querySelectorAll("[data-add-to-cart]");

      addButtons.forEach((button) => {
        const productDetail = button.closest(".product-detail__purchase");
        const formatSelect = productDetail?.querySelector("#product-format");
        const priceNode = document.querySelector(
          "[data-product-price-display]",
        );
        const feedbackNode = productDetail?.querySelector(
          "[data-add-to-cart-feedback]",
        );

        const syncSelectedFormat = () => {
          if (!formatSelect) {
            return;
          }

          const selectedOption =
            formatSelect.options[formatSelect.selectedIndex];
          const selectedPrice = Number(
            selectedOption.dataset.price || button.dataset.productPrice || 0,
          );
          const selectedSku = String(
            selectedOption.dataset.sku || button.dataset.productSku || "",
          ).trim();

          button.dataset.productVariantLabel =
            selectedOption.dataset.variantLabel ||
            selectedOption.value ||
            button.dataset.productVariantLabel;
          button.dataset.productPrice = String(selectedPrice);
          button.dataset.productSku = selectedSku;

          if (priceNode) {
            priceNode.textContent = formatMoney(selectedPrice);
          }
        };

        if (formatSelect) {
          syncSelectedFormat();
          formatSelect.addEventListener("change", syncSelectedFormat);
        }

        button.addEventListener("click", () => {
          const selectedOption =
            formatSelect?.options[formatSelect.selectedIndex];
          const variantLabel = selectedOption?.value || "Format general";
          const productSlug = button.dataset.productSlug;
          const normalizedVariantLabel =
            selectedOption?.dataset.variantLabel ||
            button.dataset.productVariantLabel ||
            variantLabel;
          const unitPrice = Number(
            selectedOption?.dataset.price || button.dataset.productPrice || 0,
          );
          const sku = String(
            selectedOption?.dataset.sku || button.dataset.productSku || "",
          ).trim();

          if (
            !sku ||
            !productSlug ||
            !normalizedVariantLabel ||
            unitPrice <= 0
          ) {
            if (feedbackNode) {
              feedbackNode.hidden = false;
              feedbackNode.dataset.state = "error";
              feedbackNode.textContent =
                "Aquest producte encara no te un format o preu valid per comprar-lo.";
            }
            return;
          }

          upsertCartItem({
            sku,
            productSlug,
            name: button.dataset.productName,
            image: button.dataset.productImage,
            currency: button.dataset.productCurrency || currency,
            variantLabel: normalizedVariantLabel,
            unitPrice,
            quantity: 1,
          });

          if (feedbackNode) {
            feedbackNode.hidden = false;
            feedbackNode.dataset.state = "success";
            feedbackNode.textContent = "Producte afegit a la cistella.";
          }
        });
      });
    };

    const bindCartPage = () => {
      const cartRoot = document.querySelector("[data-cart-items]");
      if (!cartRoot) {
        return;
      }

      const titleNode = document.querySelector("[data-cart-title]");
      const introNode = document.querySelector("[data-cart-intro]");
      const emptyNode = document.querySelector("[data-cart-empty]");
      const countNode = document.querySelector("[data-cart-product-count]");
      const subtotalNode = document.querySelector("[data-cart-subtotal]");
      const totalNode = document.querySelector("[data-cart-total]");
      const noteNode = document.querySelector("[data-cart-summary-note]");
      const shippingWarningNode = document.querySelector(
        "[data-cart-shipping-warning]",
      );
      const summaryLink = document.querySelector("[data-cart-summary-link]");
      const checkoutSection = document.querySelector("[data-checkout-section]");
      const checkoutForm = document.querySelector("[data-checkout-form]");
      const checkoutMessage = document.querySelector("[data-checkout-message]");
      const checkoutSubmitButton = checkoutForm?.querySelector(
        'button[type="submit"]',
      );
      const shippingMinimumAmount = 50;

      const fillCheckoutDraft = () => {
        if (!checkoutForm) {
          return;
        }

        const draft = readCheckoutDraft();
        Array.from(checkoutForm.elements).forEach((field) => {
          if (field.name && draft[field.name] !== undefined) {
            if (field.type === "checkbox") {
              field.checked = draft[field.name] === "on";
            } else {
              field.value = draft[field.name];
            }
          }
        });

        applyBillingState();
      };

      const billingSameCheckbox = checkoutForm?.querySelector(
        "[data-billing-same-checkbox]",
      );
      const pickupCheckbox = checkoutForm?.querySelector(
        "[data-pickup-checkbox]",
      );
      const pickupFieldsContainer = checkoutForm?.querySelector(
        "[data-pickup-fields]",
      );
      const pickupStoreSelect = checkoutForm?.querySelector(
        "[data-pickup-store-select]",
      );
      const shippingFieldsContainer = checkoutForm?.querySelector(
        "[data-shipping-fields]",
      );
      const billingFieldsContainer = checkoutForm?.querySelector(
        "[data-billing-fields]",
      );

      const getBillingFieldNames = () => [
        "billingCompany",
        "billingVat",
        "billingAddress",
        "billingCity",
        "billingPostalCode",
        "billingCountry",
      ];

      const getShippingToBillingMap = () => ({
        billingAddress: "address",
        billingCity: "city",
        billingPostalCode: "postalCode",
        billingCountry: "country",
      });

      const setBillingInputsDisabled = (disabled) => {
        if (!billingFieldsContainer) {
          return;
        }

        const inputs = billingFieldsContainer.querySelectorAll("input");
        inputs.forEach((input) => {
          input.disabled = disabled;
        });
      };

      const setPickupInputsDisabled = (disabled) => {
        if (!pickupFieldsContainer) {
          return;
        }

        const inputs = pickupFieldsContainer.querySelectorAll("select, input");
        inputs.forEach((input) => {
          input.disabled = disabled;
        });
      };

      const clearBillingFields = () => {
        if (!checkoutForm) {
          return;
        }

        getBillingFieldNames().forEach((name) => {
          const input = checkoutForm.elements.namedItem(name);
          if (input) {
            input.value = "";
          }
        });
      };

      const clearPickupFields = () => {
        if (pickupStoreSelect) {
          pickupStoreSelect.value = "";
        }
      };

      const syncBillingFields = () => {
        if (!checkoutForm || !billingSameCheckbox?.checked) {
          return;
        }

        const formData = new FormData(checkoutForm);
        const shipping = Object.fromEntries(formData.entries());
        const map = getShippingToBillingMap();

        Object.entries(map).forEach(([billingField, shippingField]) => {
          const input = checkoutForm.elements.namedItem(billingField);
          if (input) {
            input.value = shipping[shippingField] || "";
          }
        });
      };

      const applyBillingState = () => {
        if (!billingFieldsContainer) {
          return;
        }

        const isChecked = billingSameCheckbox?.checked;

        if (isChecked) {
          setBillingInputsDisabled(true);
          billingFieldsContainer.dataset.state = "readonly";
        } else {
          setBillingInputsDisabled(false);
          billingFieldsContainer.dataset.state = "editable";
        }
      };

      const applyPickupState = () => {
        const isPickup = pickupCheckbox?.checked;

        if (pickupFieldsContainer) {
          pickupFieldsContainer.dataset.state = isPickup
            ? "editable"
            : "readonly";
        }
        setPickupInputsDisabled(!isPickup);
        renderShippingMinimumWarning();
      };

      const renderShippingMinimumWarning = () => {
        if (!shippingWarningNode) {
          return;
        }

        const cart = readCart();
        const subtotal = getCartSubtotal(cart);
        const isPickup = pickupCheckbox?.checked;
        const shippingMinimumAmount = 50;

        if (
          !cart.items.length ||
          isPickup ||
          subtotal >= shippingMinimumAmount
        ) {
          shippingWarningNode.hidden = true;
          shippingWarningNode.textContent = "";
          return;
        }

        shippingWarningNode.hidden = false;
        shippingWarningNode.textContent =
          "Per fer un enviament, la comanda ha d'arribar a 50,00 €. Pots afegir mes productes o seleccionar recollida a botiga.";
      };

      billingSameCheckbox?.addEventListener("change", () => {
        if (billingSameCheckbox.checked) {
          syncBillingFields();
        } else {
          syncBillingFields();
        }
        applyBillingState();
      });

      pickupCheckbox?.addEventListener("change", () => {
        if (!pickupCheckbox.checked) {
          clearPickupFields();
        }
        applyPickupState();
      });

      // On successful return from payment, clear client-side cart/session.
      // The order is already persisted server-side.
      const normalizedPath = String(window.location?.pathname || "").replace(
        /\/+$/,
        "",
      );
      if (normalizedPath === "/payment/success") {
        clearCart();
        clearCheckoutDraft();
        clearCheckoutSession();
        updateCartCount();
      }

      const renderCartPage = () => {
        const cart = readCart();
        const hasItems = cart.items.length > 0;
        const itemCount = getCartCount(cart);
        const subtotal = getCartSubtotal(cart);

        cartRoot.innerHTML = "";
        cartRoot.hidden = !hasItems;
        if (emptyNode) {
          emptyNode.hidden = hasItems;
        }
        if (checkoutSection) {
          checkoutSection.hidden = !hasItems;
        }

        if (titleNode) {
          titleNode.textContent = hasItems
            ? "REVISA LA TEVA CISTELLA"
            : "ENCARA NO HI HA CAP PRODUCTE A LA TEVA CISTELLA";
        }

        if (introNode) {
          introNode.textContent = hasItems
            ? "Pots ajustar quantitats, eliminar productes i deixar a punt les dades d'enviament abans de passar al backend de comandes."
            : "Quan afegeixis productes des de la botiga, els trobaras aqui per revisar formats, quantitats i el resum de la comanda.";
        }

        if (countNode) {
          countNode.textContent = String(itemCount);
        }
        if (subtotalNode) {
          subtotalNode.textContent = formatMoney(subtotal);
        }
        if (totalNode) {
          totalNode.textContent = formatMoney(subtotal);
        }
        if (noteNode) {
          noteNode.textContent = hasItems
            ? ""
            : "La cistella es guarda en aquest navegador fins que finalitzis la compra.";
        }
        renderShippingMinimumWarning();
        if (summaryLink) {
          summaryLink.textContent = hasItems
            ? "TORNAR A LA BOTIGA"
            : "SEGUIR COMPRANT";
        }

        if (!hasItems) {
          return;
        }

        const itemsMarkup = cart.items
          .map((item) => {
            const lineTotal =
              Number(item.unitPrice || 0) * Number(item.quantity || 0);

            return `
              <article class="shop-cart-item" data-cart-item data-sku="${item.sku}" data-slug="${item.productSlug}" data-variant="${item.variantLabel}">
                <img src="${item.image}" alt="${item.name}" class="shop-cart-item__image" />
                <div class="shop-cart-item__body">
                  <div class="shop-cart-item__top">
                    <div>
                      <h3 class="shop-cart-item__name">${item.name}</h3>
                      <div class="shop-cart-item__meta">
                        <p class="shop-cart-item__variant">Format: ${item.variantLabel}</p>
                        <p class="shop-cart-item__price">Preu unitari: ${formatMoney(item.unitPrice)}</p>
                      </div>
                    </div>
                    <p class="shop-cart-item__line-total">${formatMoney(lineTotal)}</p>
                  </div>
                  <div class="shop-cart-item__actions">
                    <div class="shop-cart-item__qty" aria-label="Quantitat">
                      <button type="button" class="shop-cart-item__qty-button" data-cart-decrease>-</button>
                      <span>${item.quantity}</span>
                      <button type="button" class="shop-cart-item__qty-button" data-cart-increase>+</button>
                    </div>
                    <button type="button" class="shop-cart-item__remove" data-cart-remove>Eliminar</button>
                  </div>
                </div>
              </article>
            `;
          })
          .join("");

        cartRoot.innerHTML = itemsMarkup;
      };

      const updateQuantity = (sku, delta) => {
        const cart = readCart();
        const item = cart.items.find(
          (entry) => entry.sku && sku && entry.sku === sku,
        );

        if (!item) {
          return;
        }

        item.quantity += delta;
        cart.items = cart.items.filter((entry) => entry.quantity > 0);
        writeCart(cart);
        updateCartCount();
        renderCartPage();
      };

      cartRoot.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const itemNode = target.closest("[data-cart-item]");
        if (!itemNode) {
          return;
        }

        const sku = itemNode.dataset.sku;
        if (!sku) {
          return;
        }

        if (target.matches("[data-cart-increase]")) {
          updateQuantity(sku, 1);
        }

        if (target.matches("[data-cart-decrease]")) {
          updateQuantity(sku, -1);
        }

        if (target.matches("[data-cart-remove]")) {
          updateQuantity(sku, -999);
        }
      });

      checkoutForm?.addEventListener("input", (event) => {
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        ) {
          target.setCustomValidity("");
        }

        const shippingFields = new Set([
          "name",
          "email",
          "phone",
          "country",
          "address",
          "city",
          "postalCode",
        ]);
        if (shippingFields.has(target.name)) {
          syncBillingFields();
        }

        const formData = new FormData(checkoutForm);
        saveCheckoutDraft(Object.fromEntries(formData.entries()));
      });

      checkoutForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const cart = readCart();
        const formData = new FormData(checkoutForm);
        const payload = normalizeCheckoutPayload(
          Object.fromEntries(formData.entries()),
        );
        if (checkoutMessage) {
          checkoutMessage.hidden = false;
        }

        const validationError = getCheckoutValidationError(payload);
        if (validationError) {
          const invalidField = checkoutForm?.elements.namedItem(
            validationError.field,
          );
          if (
            invalidField instanceof HTMLInputElement ||
            invalidField instanceof HTMLTextAreaElement ||
            invalidField instanceof HTMLSelectElement
          ) {
            invalidField.setCustomValidity(validationError.message);
            invalidField.reportValidity();
            invalidField.focus();
          }

          if (checkoutMessage) {
            checkoutMessage.dataset.state = "error";
            checkoutMessage.textContent = validationError.message;
          }
          return;
        }

        if (!cart.items.length) {
          if (checkoutMessage) {
            checkoutMessage.dataset.state = "error";
            checkoutMessage.textContent =
              "La cistella esta buida. Afegeix-hi algun producte abans de continuar.";
          }
          return;
        }

        const subtotal = getCartSubtotal(cart);
        if (payload.isPickup !== "on" && subtotal < shippingMinimumAmount) {
          if (checkoutMessage) {
            checkoutMessage.dataset.state = "error";
            checkoutMessage.textContent =
              "L'import minim per a enviaments es de 50,00 €. Pots continuar amb recollida a botiga o afegir mes productes.";
          }
          return;
        }

        const invalidItem = cart.items.find(
          (item) => !String(item.sku || "").trim(),
        );
        if (invalidItem) {
          if (checkoutMessage) {
            checkoutMessage.dataset.state = "error";
            checkoutMessage.textContent =
              "Hi ha un producte a la cistella sense SKU. Torna a afegir els productes a la cistella.";
          }
          return;
        }

        saveCheckoutDraft(payload);

        const cartFingerprint = buildCartFingerprint(cart);
        const existingSession = readCheckoutSession();

        if (checkoutSubmitButton) {
          checkoutSubmitButton.disabled = true;
          checkoutSubmitButton.textContent = "PREPARANT LA COMANDA...";
        }

        try {
          if (checkoutMessage) {
            checkoutMessage.dataset.state = "success";
            checkoutMessage.textContent =
              "Creant la comanda i preparant el pas de pagament...";
          }

          let order = null;
          if (
            existingSession?.orderId &&
            existingSession?.publicOrderCode &&
            existingSession?.cartFingerprint === cartFingerprint &&
            existingSession?.customerEmail === payload.email &&
            existingSession?.paymentMethod === payload.paymentMethod
          ) {
            order = {
              id: existingSession.orderId,
              publicOrderCode: existingSession.publicOrderCode,
            };
          } else {
            clearCheckoutSession();
            // Server-side pricing is authoritative; we only send sku + quantity.
            order = await createOrder({
              items: cart.items.map((item) => ({
                sku: item.sku,
                quantity: item.quantity,
              })),
              customer: payload,
            });
            saveCheckoutSession({
              orderId: order.id,
              publicOrderCode: order.publicOrderCode,
              customerEmail: payload.email,
              paymentMethod: payload.paymentMethod,
              cartFingerprint,
              createdAt: new Date().toISOString(),
            });
          }

          const paymentResult = await initiatePayment({
            orderId: order.id,
            publicOrderCode: order.publicOrderCode,
            paymentMethod: payload.paymentMethod,
          });

          if (
            paymentResult.ok &&
            paymentResult.data?.success &&
            paymentResult.data?.payment
          ) {
            if (checkoutMessage) {
              checkoutMessage.dataset.state = "success";
              checkoutMessage.textContent = `Comanda ${order.publicOrderCode} creada. Redirigint cap al pagament...`;
            }
            submitPaymentForm(paymentResult.data.payment);
            return;
          }

          if (paymentResult.status === 503) {
            if (checkoutMessage) {
              checkoutMessage.dataset.state = "error";
              checkoutMessage.textContent =
                "No hem pogut iniciar el pagament ara mateix. Torna-ho a provar en uns minuts o contacta amb nosaltres.";
            }
            return;
          }

          throw new Error(
            paymentResult.data?.details ||
              paymentResult.data?.error ||
              "No hem pogut preparar el pagament ara mateix.",
          );
        } catch (error) {
          if (checkoutMessage) {
            checkoutMessage.dataset.state = "error";
            checkoutMessage.textContent =
              error.message || "Hi ha hagut un error en preparar la comanda.";
          }
        } finally {
          if (checkoutSubmitButton) {
            checkoutSubmitButton.disabled = false;
            checkoutSubmitButton.textContent = "CONTINUAR CAP AL PAGAMENT";
          }
        }
      });

      fillCheckoutDraft();
      applyPickupState();
      renderCartPage();
    };

    updateCartCount();
    bindProductActions();
    bindCartPage();
  };

  setupProfessionalsValueFeature();
  setupProjecteFireTextSlider();
  setupHeaderDropdown();
  setupContactForm();
  setupVisitBooking();
  setupVisitExperienceModals();
  setupCookieBanner();
  setupConsentMaps();
  setupFustaShowcase();
  setupCart();
});
