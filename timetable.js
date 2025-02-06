// DOM Elements
const branchSelect = document.getElementById("branch");
const prepareSection = document.getElementById("prepare-section");
const viewSection = document.getElementById("view-section");
const generateSection = document.getElementById("generate-section");
const datesSection = document.getElementById("dates-section");
const timetableContainer = document.getElementById("timetable-container");
const batchYearInput = document.getElementById("batch-year");
const semesterSelect = document.getElementById("semester");
const yearSelect = document.getElementById("year");
const prepareBranchSelect = document.getElementById("prepare-branch");
const fetchSectionsButton = document.getElementById("fetch-sections");
const sectionsList = document.getElementById("sections-list");
const createScheduleButton = document.getElementById("create-schedule");
const sectionsSchedule = document.getElementById("sections-schedule");
const generateSessionsButton = document.getElementById("generate-sessions");
const semesterStartInput = document.getElementById("semester-start");
const semesterEndInput = document.getElementById("semester-end");
const fetchDatesButton = document.getElementById("fetch-dates-sections");
const datesSectionsList = document.getElementById("dates-sections-list");
const trainingDatesList = document.getElementById("training-dates-list");

// Event Listeners
document.querySelectorAll(".sidebar-nav a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const action = e.target.dataset.action;
    showSection(action);
  });
});

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const periods = Array.from({ length: 7 }, (_, i) => i + 1);

branchSelect?.addEventListener("change", handleBranchChange);
fetchSectionsButton?.addEventListener("click", handleFetchSections);
createScheduleButton?.addEventListener("click", handleCreateSchedule);
generateSessionsButton?.addEventListener("click", handleGenerateSessions);
fetchDatesButton?.addEventListener("click", handleFetchDatesSections);

// Functions
function showSection(action) {
  // Hide all sections
  viewSection.style.display = "none";
  prepareSection.style.display = "none";
  generateSection.style.display = "none";
  datesSection.style.display = "none";

  // Show selected section
  switch (action) {
    case "view":
      viewSection.style.display = "block";
      break;
    case "prepare":
      prepareSection.style.display = "block";
      break;
    case "generate":
      generateSection.style.display = "block";
      break;
    case "dates":
      datesSection.style.display = "block";
      break;
  }

  // Update active state in sidebar
  document.querySelectorAll(".sidebar-nav a").forEach((link) => {
    link.classList.toggle("active", link.dataset.action === action);
  });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  // Handle both "HH:mm:ss" and "HH:mm" formats
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  const [_, hours, minutes] = match;
  return `${hours}:${minutes}`;
}

async function handleFetchDatesSections() {
  const batchYear = document.getElementById("dates-batch-year").value;
  const semester = document.getElementById("dates-semester").value;
  const year = document.getElementById("dates-year").value;
  const branch = document.getElementById("dates-branch").value;

  if (!batchYear || !semester || !year || !branch) {
    alert("Please fill in all fields");
    return;
  }

  try {
    const response = await fetch(
      `/api/academic-batches?batch_year=${batchYear}&semester=${semester}&year=${year}&branch=${branch}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch sections");
    }
    const sections = await response.json();
    displayDatesSections(sections);
  } catch (error) {
    console.error("Error:", error);
    alert("Failed to fetch sections");
  }
}

function displayDatesSections(sections) {
  datesSectionsList.innerHTML = "";
  datesSectionsList.style.display = "grid";
  trainingDatesList.style.display = "none";

  sections.forEach((section) => {
    const button = document.createElement("button");
    button.className = "section-button";
    button.textContent = `Section ${section.section}`;
    button.addEventListener("click", () => handleSectionClick(section));
    datesSectionsList.appendChild(button);
  });
}

async function handleSectionClick(section) {
  try {
    const batchYear = document.getElementById("dates-batch-year").value;
    const semester = document.getElementById("dates-semester").value;
    const year = document.getElementById("dates-year").value;
    const branch = document.getElementById("dates-branch").value;

    const response = await fetch(
      `/api/training-sessions?batch_year=${batchYear}&semester=${semester}&year=${year}&branch=${branch}&section=${section.section}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch training dates");
    }
    const dates = await response.json();
    displayTrainingDates(dates);
  } catch (error) {
    console.error("Error:", error);
    alert("Failed to fetch training dates");
  }
}

function displayTrainingDates(dates) {
  trainingDatesList.innerHTML = "";
  trainingDatesList.style.display = "grid";

  if (dates.length === 0) {
    const message = document.createElement("div");
    message.className = "no-dates-message";
    message.textContent = "No training dates available";
    trainingDatesList.appendChild(message);
    return;
  }

  dates.sort((a, b) => new Date(a.date) - new Date(b.date));

  dates.forEach((date) => {
    const dateObj = new Date(date.date);
    const card = document.createElement("div");
    card.className = "date-card";

    const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });
    const monthDay = dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    card.innerHTML = `
      <div class="weekday">${weekday}</div>
      <div class="date">${monthDay}</div>
      <div class="time">${formatTime(date.start_time)} - ${formatTime(
      date.end_time
    )}</div>
    `;

    trainingDatesList.appendChild(card);
  });
}

async function handleBranchChange() {
  const branch = branchSelect.value;
  if (!branch) {
    timetableContainer.innerHTML = "";
    return;
  }

  try {
    const response = await fetch(`/api/training-schedules?branch=${branch}`);
    if (!response.ok) {
      throw new Error("Failed to fetch schedules");
    }
    const schedules = await response.json();
    displayTimetables(schedules);
  } catch (error) {
    console.error("Error:", error);
    alert("Failed to fetch schedules");
  }
}

function displayTimetables(schedules) {
  timetableContainer.innerHTML = "";

  // Group schedules by year
  const schedulesByYear = {};
  schedules.forEach((schedule) => {
    if (!schedulesByYear[schedule.year]) {
      schedulesByYear[schedule.year] = [];
    }
    schedulesByYear[schedule.year].push(schedule);
  });

  // Create timetable for each year
  Object.entries(schedulesByYear)
    .sort(([yearA], [yearB]) => yearA - yearB)
    .forEach(([year, yearSchedules]) => {
      const yearContainer = document.createElement("div");
      yearContainer.className = "year-container";

      const yearTitle = document.createElement("h2");
      yearTitle.className = "year-title";
      yearTitle.textContent = `Year ${year}`;
      yearContainer.appendChild(yearTitle);

      const timetableGrid = createTimetableGrid(yearSchedules);
      yearContainer.appendChild(timetableGrid);

      timetableContainer.appendChild(yearContainer);
    });
}

function createTimetableGrid(schedules) {
  const grid = document.createElement("div");
  grid.className = "timetable-grid";

  // Create header
  const header = document.createElement("div");
  header.className = "grid-header";

  header.appendChild(createCell("Day/Period"));
  periods.forEach((period) => {
    header.appendChild(createCell(`Period ${period}`));
  });

  grid.appendChild(header);

  // Create rows for each day
  days.forEach((day) => {
    const row = document.createElement("div");
    row.className = "grid-row";

    // Add day label
    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label";
    dayLabel.textContent = day;
    row.appendChild(dayLabel);

    // Process schedules for this day
    const dayIndex = days.indexOf(day) + 1;
    const daySchedules = schedules.filter(
      (schedule) => schedule.day_of_week === dayIndex
    );

    // Create period cells
    let currentPeriod = 1;
    while (currentPeriod <= 7) {
      const schedulesForPeriod = daySchedules.filter(
        (schedule) =>
          currentPeriod >= schedule.start_period &&
          currentPeriod <= schedule.end_period
      );

      if (schedulesForPeriod.length > 0) {
        const schedule = schedulesForPeriod[0];
        const span = schedule.end_period - schedule.start_period + 1;

        const cell = document.createElement("div");
        cell.className = "period-cell";
        cell.style.gridColumn = `span ${span}`;

        const sectionBox = document.createElement("div");
        sectionBox.className = "section-box";
        sectionBox.textContent = `Section ${schedule.section}`;
        cell.appendChild(sectionBox);

        row.appendChild(cell);
        currentPeriod += span;
      } else {
        const cell = document.createElement("div");
        cell.className = "period-cell";
        row.appendChild(cell);
        currentPeriod++;
      }
    }

    grid.appendChild(row);
  });

  return grid;
}

function createCell(text) {
  const cell = document.createElement("div");
  cell.textContent = text;
  return cell;
}

async function handleFetchSections() {
  const batchYear = batchYearInput.value;
  const semester = semesterSelect.value;
  const year = yearSelect.value;
  const branch = prepareBranchSelect.value;

  if (!batchYear || !semester || !year || !branch) {
    alert("Please fill in all fields");
    return;
  }

  try {
    const response = await fetch(
      `/api/academic-batches?batch_year=${batchYear}&semester=${semester}&year=${year}&branch=${branch}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch sections");
    }
    const sections = await response.json();
    displaySectionScheduleForm(sections);
  } catch (error) {
    console.error("Error:", error);
    alert("Failed to fetch sections");
  }
}

function displaySectionScheduleForm(sections) {
  sectionsSchedule.style.display = "block";
  sectionsList.innerHTML = "";

  sections.forEach((section) => {
    const sectionDiv = document.createElement("div");
    sectionDiv.className = "section-row";
    sectionDiv.innerHTML = `
      <div class="section-label">Section ${section.section}</div>
      <select class="day-select" data-section="${section.section}">
        <option value="">Select Day</option>
        <option value="1">Monday</option>
        <option value="2">Tuesday</option>
        <option value="3">Wednesday</option>
        <option value="4">Thursday</option>
        <option value="5">Friday</option>
        <option value="6">Saturday</option>
      </select>
      <select class="start-period" data-section="${section.section}">
        <option value="">Start Period</option>
        ${Array.from(
          { length: 7 },
          (_, i) => `<option value="${i + 1}">Period ${i + 1}</option>`
        ).join("")}
      </select>
      <select class="end-period" data-section="${section.section}">
        <option value="">End Period</option>
        ${Array.from(
          { length: 7 },
          (_, i) => `<option value="${i + 1}">Period ${i + 1}</option>`
        ).join("")}
      </select>
    `;
    sectionsList.appendChild(sectionDiv);
  });
}

async function handleCreateSchedule() {
  const batchYear = batchYearInput.value;
  const semester = semesterSelect.value;
  const year = yearSelect.value;
  const branch = prepareBranchSelect.value;

  const schedules = [];
  const sections = document.querySelectorAll(".section-row");

  for (const sectionDiv of sections) {
    const section = sectionDiv
      .querySelector(".section-label")
      .textContent.split(" ")[1];
    const dayOfWeek = sectionDiv.querySelector(".day-select").value;
    const startPeriod = sectionDiv.querySelector(".start-period").value;
    const endPeriod = sectionDiv.querySelector(".end-period").value;

    if (!dayOfWeek || !startPeriod || !endPeriod) {
      alert(`Please complete all fields for Section ${section}`);
      return;
    }

    if (parseInt(endPeriod) < parseInt(startPeriod)) {
      alert(`End period cannot be before start period for Section ${section}`);
      return;
    }

    schedules.push({
      batch_year: parseInt(batchYear),
      semester,
      year: parseInt(year),
      branch,
      section,
      day_of_week: parseInt(dayOfWeek),
      start_period: parseInt(startPeriod),
      end_period: parseInt(endPeriod),
    });
  }

  try {
    for (const schedule of schedules) {
      const response = await fetch("/api/training-schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(schedule),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to create schedule for Section ${schedule.section}`
        );
      }
    }

    alert("Schedules created successfully");
    // Reset form
    batchYearInput.value = "";
    semesterSelect.value = "";
    yearSelect.value = "";
    prepareBranchSelect.value = "";
    sectionsSchedule.style.display = "none";
  } catch (error) {
    console.error("Error:", error);
    alert(error.message);
  }
}

async function handleGenerateSessions() {
  const batchYear = document.getElementById("gen-batch-year").value;
  const year = document.getElementById("gen-year").value;
  const semester = document.getElementById("gen-semester").value;
  const branch = document.getElementById("gen-branch").value;
  const startDate = document.getElementById("semester-start").value;
  const endDate = document.getElementById("semester-end").value;

  if (!batchYear || !year || !semester || !branch || !startDate || !endDate) {
    alert("Please fill in all fields");
    return;
  }

  try {
    const response = await fetch("/api/semester-dates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        batch_year: parseInt(batchYear),
        year: parseInt(year),
        semester,
        branch,
        start_date: startDate,
        end_date: endDate,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save semester dates and generate sessions");
    }

    alert("Semester dates saved and training sessions generated successfully");

    // Reset form
    document.getElementById("gen-batch-year").value = "";
    document.getElementById("gen-year").value = "";
    document.getElementById("gen-semester").value = "";
    document.getElementById("gen-branch").value = "";
    document.getElementById("semester-start").value = "";
    document.getElementById("semester-end").value = "";
  } catch (error) {
    console.error("Error:", error);
    alert(error.message);
  }
}

// Initialize view section by default
showSection("view");
