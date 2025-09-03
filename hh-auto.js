// TODO: instead of timers use  some  method  like  checkInDOM() with MutationObserver or requestAnimationFrame
// TODO: use localStorage for vacancies
// TODO: add apply button content checking(already applied)
// TODO: add menu element with all unhandled links(clickable)
// TODO: handle another country alert
// TODO: fix bug with double apply if redirected
// TODO: fix pagination
// TODO: instead of iterational method  use function  calling on  DOM  update
const COVER_LETTER_TEXT = "__PLACEHOLDER__"; // your cover letter (!NON-EMPTY!)
const RESTART_ON_ERROR = false; // be aware of potential memory leak
const NEXT_PAGE_LOADING_TIMER_MS = 6000; //paginator next page loading time
const VACANCY_APPLY_TIMER_MS = 3000; // job apply query loading time
const RENDER_TIMER_MS = 100; // timer for DOM rearrange and render
const SCRIPT_PREFIX = "----AUTO_HH----"; // prefix to filter logs from other junk
const APPLY_DAY_LIMIT = 200; // headhunter apply limit
const REDIRECT_VACANCY_IDS_LOCAL_STORAGE_KEY = "REDIRECT_VACANCY_IDS";

let currentVacancy;
let appliedAmount = 0;
let inLimit = false;
let currentPageNumber = Number(getCurrentPageElement().innerText);
const visitedSet = new Set([]);
const vacanciesWithRedirectLinks = new Set([]);
let vacanciesSearchHref = null;
let vacancyClick = false;

function addRedirectedVacancyIdToLocalStorage(id) {
  console.log("ADD VACANDY ID: ", id);
  const prevData =
    JSON.parse(
      window.localStorage.getItem(REDIRECT_VACANCY_IDS_LOCAL_STORAGE_KEY),
    ) || [];
  const newData = JSON.stringify(Array.from(new Set([...prevData, id])));
  window.localStorage.setItem(REDIRECT_VACANCY_IDS_LOCAL_STORAGE_KEY, newData);
}
function getRedirectedVacancyIdsFromLocalStorage() {
  return new Set(
    JSON.parse(
      window.localStorage.getItem(REDIRECT_VACANCY_IDS_LOCAL_STORAGE_KEY),
    ) || [],
  );
}

function createForceStartButton() {
  const myDiv = document.querySelector(".HH-MainContent");
  const myNewNode = document.createElement("button");
  const textInside = document.createTextNode("START AUTO-HH");
  myNewNode.addEventListener("click", runTasks);
  Object.assign(myNewNode.style, {
    position: "fixed",
    top: 0,
    right: 0,
    "z-index": 99999,
    background: "red",
    color: "white",
    padding: "10px",
    margin: "50px",
  });

  myNewNode.setAttribute("id", "forceStartButton");
  myNewNode.appendChild(textInside);
  myDiv.appendChild(myNewNode);
}
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

async function goToNextPage() {
  const nextPageBtn = document.querySelector("[data-qa^='pager-next']");
  if (nextPageBtn) {
    nextPageBtn.click();
  }
  await wait(NEXT_PAGE_LOADING_TIMER_MS);
}

function getVacancies() {
  const vacancies = Array.from(
    document.querySelectorAll("[class^='vacancy-card']"),
  );
  const redirected = getRedirectedVacancyIdsFromLocalStorage();
  return vacancies.reduce((acc, current) => {
    const btn = current.querySelector(
      "[data-qa='vacancy-serp__vacancy_response']",
    );
    const vacancy = {
      vacancyEl: current,
      vacancyApplyBtnEl: btn,
      vacancyHref: btn?.href,
      vacancyId: btn?.href && getVacancyId(btn?.href),
      vacancyText: current.innerText,
    };
    if (redirected.has(vacancy.vacancyId)) return acc;
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

window.setInterval(() => {
  if (!document.getElementById("forceStartButton")) createForceStartButton();
}, 9500);

async function redirectHandler(e) {
  await wait(VACANCY_APPLY_TIMER_MS / 2);

  if (
    e.navigationType === "push" &&
    vacanciesSearchHref !== e.destination.url &&
    currentVacancy
  ) {
    vacanciesWithRedirectLinks.add(currentVacancy?.vacancyHref);
    addRedirectedVacancyIdToLocalStorage(currentVacancy?.vacancyId);
    console.log(SCRIPT_PREFIX, "REDIRECT: GOING BACK");
    history.back();
  }
}

navigation.addEventListener("navigate", redirectHandler);

async function runTasks() {
  vacanciesSearchHref = window.location.href;
  try {
    let overfill = false;
    const vacancies = getVacancies();

    for (vacancy of vacancies) {
      vacancyRedirect = false;

      console.log(
        SCRIPT_PREFIX,
        "CURRENT STATE",
        "\nCURRENT VACANCY: ",
        vacancy,
        "\nVISITED VACANCIES LINKS: ",
        visitedSet,
        "\nUNHANDLED VACANCIES LINKS: ",
        vacanciesWithRedirectLinks,
      );

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
      await wait(VACANCY_APPLY_TIMER_MS);

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

  // const pages = getPages();
  // const nextPageInPaginator = pages[currentPageNumber]?.pageEl;
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

  // nextPageInPaginator.click();
  // await wait(NEXT_PAGE_LOADING_TIMER_MS);
  currentPageNumber++;
  await goToNextPage();
  runTasks();
}
createForceStartButton();
