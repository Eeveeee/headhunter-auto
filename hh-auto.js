// TODO: instead of timers use  some  method  like  checkInDOM() with MutationObserver or requestAnimationFrame
// TODO: use localStorage for vacancies
// TODO: add apply button content checking(already applied)

const COVER_LETTER_TEXT = "PLACEHOLDER"; // your cover letter (!NON-EMPTY!)
const RESTART_ON_ERROR = false; // be aware of potential memory leak
const NEXT_PAGE_LOADING_TIMER_MS = 6000; //paginator next page loading time
const VACANCY_APPLY_TIMER_MS = 3000; // job apply query loading time
const RENDER_TIMER_MS = 100; // timer for DOM rearrange and render
const SCRIPT_PREFIX = "----AUTO_HH----"; // prefix to filter logs from other junk
const APPLY_DAY_LIMIT = 200; // headhunter apply limit

let currentVacancy;
let appliedAmount = 0;
let inLimit = false;
let currentPageNumber = Number(getCurrentPageElement().innerText);
let pageNumberOnRedirect = currentPageNumber;
const visitedSet = new Set([]);
const vacanciesWithRedirectLinks = new Set([]);
let vacanciesSearchHref = null;
let vacancyClick = false;

function checkForApplyLimitAlert() {
  return !!document
    .getElementById("dialog-description")
    ?.innerText?.includes(String(APPLY_DAY_LIMIT));
}
function triggerInputChange(node, value = "") {
  const inputTypes = [
    window.HTMLInputElement,
    window.HTMLSelectElement,
    window.HTMLTextAreaElement,
  ];

  // only process the change on elements we know have a value setter in their constructor
  if (inputTypes.indexOf(node.__proto__.constructor) > -1) {
    const setValue = Object.getOwnPropertyDescriptor(
      node.__proto__,
      "value",
    ).set;
    const event = new Event("input", { bubbles: true });

    setValue.call(node, value);
    node.dispatchEvent(event);
  }
}
function getCurrentPageElement() {
  return document.querySelector('a[aria-current="true"]');
}
function getVacancyId(url) {
  if (!url) return null;

  const u = new URL(url);

  let id = u.searchParams.get("vacancyId");
  if (id) return id;

  const match = u.pathname.match(/\/vacancy\/(\d+)/);
  return match ? match[1] : null;
}
function isSameVacancy(url1, url2) {
  const getId = (url) => new URL(url).searchParams.get("vacancyId");
  return getId(url1) === getId(url2);
}
function wait(ms = 100) {
  return new Promise((res) => setTimeout(res, ms));
}
function getPages() {
  const pagesContainer = document.querySelector("[data-qa^='pager-block']");
  const pageLinkElements = Array.from(pagesContainer.querySelectorAll("a"));
  return pageLinkElements.map((el, idx) => ({
    href: el.href,
    pageEl: el,
    pageNum: idx,
  }));
}
function getVacancies() {
  const vacancies = Array.from(
    document.querySelectorAll("[class^='vacancy-card']"),
  );
  return vacancies.reduce((acc, current) => {
    const btn = current.querySelector(
      "[data-qa='vacancy-serp__vacancy_response']",
    );
    const vacancy = {
      vacancyEl: current,
      vacancyApplyBtnEl: btn,
      vacancyHref: btn?.href,
      vacancyId: btn?.href && getVacancyId(btn?.href),
    };
    if (
      vacancy.vacancyEl &&
      vacancy.vacancyApplyBtnEl &&
      vacancy.vacancyHref &&
      vacancy.vacancyId
    ) {
      const a = acc.push(vacancy);
    }
    return acc;
  }, []);
}
function findVacancyById(id) {
  return getVacancies().find((el) => el.vacancyId === id);
}
async function redirectHandler(e) {
  if (window.location.href === vacanciesSearchHref) return;
  if (!vacancyClick) return;

  if (currentVacancy.vacancyId)
    vacanciesWithRedirectLinks.add(vacancy.vacancyHref);

  history.back();
}

navigation.addEventListener("navigate", redirectHandler);

const runTasks = async () => {
  vacanciesSearchHref = window.location.href;
  try {
    let overfill = false;
    const vacancies = getVacancies();

    for (vacancy of vacancies) {
      const currentVacanices = getVacancies();
      const foundVacancy = currentVacanices.find(
        (v) => v.vacancyId === vacancy.vacancyId,
      );
      const total = appliedAmount + vacanciesWithRedirectLinks.size;
      if (total >= APPLY_DAY_LIMIT) {
        overfill = true;
        break;
      }
      if (!foundVacancy) {
        continue;
      }
      currentVacancy = foundVacancy;
      foundVacancy.vacancyEl.scrollIntoView();
      vacancyClick = true;
      foundVacancy.vacancyApplyBtnEl.click();
      if (checkForApplyLimitAlert()) {
        inLimit = true;
        break;
      }
      await wait(RENDER_TIMER_MS);
      // foreign country alert check
      document
        .querySelector(".bloko-modal-footer .bloko-button_kind-success")
        ?.click();
      // cover letter input appearance check
      const coverLetter = document.querySelector(
        "[data-qa=vacancy-response-popup-form-letter-input]",
      );
      const coverLetterApplyButton = document.querySelector(
        'button[form="RESPONSE_MODAL_FORM_ID"]',
      );
      if (coverLetter) {
        triggerInputChange(coverLetter, COVER_LETTER_TEXT);
        await wait(RENDER_TIMER_MS);
        coverLetterApplyButton?.click();
      }

      await wait(VACANCY_APPLY_TIMER_MS);
      vacancyClick = false;
      visitedSet.add(foundVacancy.vacancyHref);
      appliedAmount++;
    }
  } catch (err) {
    console.log(SCRIPT_PREFIX, "ERROR: ", err);
    console.log(SCRIPT_PREFIX, "RESTART ON ERROR:", RESTART_ON_ERROR);
    console.log(
      SCRIPT_PREFIX,
      "UNHANDLED VACANCIES LINKS:",
      vacanciesWithRedirectLinks,
    );

    if (!RESTART_ON_ERROR) return;
    runTasks();
  }

  if (inLimit) {
    console.log(
      SCRIPT_PREFIX,
      "APPLY DAY LIMIT REACHED, SCRIPT HAS BEEN STOPPED",
    );
    return;
  }

  if (overfill) {
    console.log(
      SCRIPT_PREFIX,
      "DAY LIMIT REACHED, THERE IS REDIRECT LINKS:",
      vacanciesWithRedirectLinks,
    );
    return;
  }

  const pages = getPages();
  const nextPageInPaginator = pages[currentPageNumber]?.pageEl;
  console.log(
    SCRIPT_PREFIX,
    "UNHANDLED VACANCIES LINKS:",
    vacanciesWithRedirectLinks,
  );
  console.log(
    SCRIPT_PREFIX,
    "HANDLED VACANCIES AMOUNT:",
    appliedAmount - vacanciesWithRedirectLinks.size,
  );

  if (nextPageInPaginator) {
    currentPageNumber++;
    nextPageInPaginator.click();
    await wait(NEXT_PAGE_LOADING_TIMER_MS);
    runTasks();
  }
};

runTasks();
