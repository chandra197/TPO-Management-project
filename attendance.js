// DOM Elements
const yearSelect = document.getElementById('year');
const branchSelect = document.getElementById('branch');
const batchYearInput = document.getElementById('batch-year');
const semesterSelect = document.getElementById('semester');
const fetchSectionsButton = document.getElementById('fetch-sections');
const sectionsList = document.getElementById('sections-list');
const trainingDates = document.getElementById('training-dates');
const attendanceList = document.getElementById('attendance-list');
const studentsList = document.getElementById('students-list');
const submitAttendanceButton = document.getElementById('submit-attendance');

// State management
let currentSessionId = null;
let absentStudents = new Set();
let currentSection = null;
let isUpdateMode = false;

// Event Listeners
document.querySelectorAll('.sidebar-nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const action = e.target.dataset.action;
    showSection(action);
    isUpdateMode = action === 'update';
  });
});

fetchSectionsButton?.addEventListener('click', handleFetchSections);
submitAttendanceButton?.addEventListener('click', handleSubmitAttendance);

// Functions
function showSection(action) {
  document.querySelectorAll('.attendance-section').forEach(section => {
    section.style.display = 'none';
  });

  document.getElementById(`${action}-section`).style.display = 'block';

  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.classList.toggle('active', link.dataset.action === action);
  });

  // Reset state when switching sections
  resetState();
}

function resetState() {
  currentSessionId = null;
  absentStudents.clear();
  currentSection = null;
  sectionsList.style.display = 'none';
  trainingDates.style.display = 'none';
  attendanceList.style.display = 'none';
}

async function handleFetchSections() {
  const batchYear = batchYearInput.value;
  const semester = semesterSelect.value;
  const year = yearSelect.value;
  const branch = branchSelect.value;

  if (!batchYear || !semester || !year || !branch) {
    alert('Please fill in all fields');
    return;
  }

  try {
    const response = await fetch(
      `/api/academic-batches?batch_year=${batchYear}&semester=${semester}&year=${year}&branch=${branch}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch sections');
    }
    
    const sections = await response.json();
    displaySections(sections);
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to fetch sections');
  }
}

function displaySections(sections) {
  sectionsList.innerHTML = '';
  sectionsList.style.display = 'grid';
  trainingDates.style.display = 'none';
  attendanceList.style.display = 'none';

  sections.forEach(section => {
    const button = document.createElement('button');
    button.className = 'section-button';
    button.textContent = `Section ${section.section}`;
    button.addEventListener('click', () => handleSectionClick(section));
    sectionsList.appendChild(button);
  });
}

async function handleSectionClick(section) {
  // Remove active class from all section buttons
  document.querySelectorAll('.section-button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Add active class to clicked button
  const clickedButton = event.target;
  clickedButton.classList.add('active');

  // Store current section
  currentSection = section;

  try {
    const batchYear = batchYearInput.value;
    const semester = semesterSelect.value;
    const year = yearSelect.value;
    const branch = branchSelect.value;

    const endpoint = isUpdateMode ? '/api/training-sessions' : '/api/unmarked-sessions';
    const response = await fetch(
      `${endpoint}?batch_year=${batchYear}&semester=${semester}&year=${year}&branch=${branch}&section=${section.section}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch training dates');
    }
    
    const dates = await response.json();
    displayTrainingDates(dates);
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to fetch training dates');
  }
}

function displayTrainingDates(dates) {
  trainingDates.innerHTML = '';
  trainingDates.style.display = 'grid';
  attendanceList.style.display = 'none';
  absentStudents.clear();

  if (dates.length === 0) {
    const message = document.createElement('div');
    message.className = 'no-dates-message';
    message.textContent = isUpdateMode ? 'No marked sessions available' : 'No unmarked sessions available';
    trainingDates.appendChild(message);
    return;
  }

  dates.forEach(date => {
    const dateObj = new Date(date.date);
    const button = document.createElement('button');
    button.className = 'date-button';
    
    const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    button.innerHTML = `
      <span class="weekday">${weekday}</span>
      <span class="date">${monthDay}</span>
      <span class="time">${formatTime(date.start_time)} - ${formatTime(date.end_time)}</span>
    `;
    
    button.addEventListener('click', () => handleDateClick(date.id));
    trainingDates.appendChild(button);
  });
}

function formatTime(timeStr) {
  return timeStr.substring(0, 5);
}

async function handleDateClick(sessionId) {
  if (!currentSection) {
    alert('Please select a section first');
    return;
  }

  currentSessionId = sessionId;
  try {
    const year = yearSelect.value;
    const branch = branchSelect.value;
    const section = currentSection.section;

    const studentsResponse = await fetch(`/api/students/${year}/${branch}/${section}`);
    if (!studentsResponse.ok) {
      throw new Error('Failed to fetch students');
    }
    
    const students = await studentsResponse.json();

    if (isUpdateMode) {
      const attendanceResponse = await fetch(`/api/attendance/${sessionId}`);
      if (!attendanceResponse.ok) {
        throw new Error('Failed to fetch attendance');
      }
      const attendance = await attendanceResponse.json();
      displayStudentsListWithAttendance(students, attendance);
    } else {
      displayStudentsList(students);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to fetch data');
  }
}

function displayStudentsList(students) {
  attendanceList.style.display = 'block';
  studentsList.innerHTML = '';
  absentStudents.clear();

  students.forEach(student => {
    const row = document.createElement('tr');
    row.id = `student-${student.id}`;
    row.innerHTML = `
      <td>${student.hall_ticket_number}</td>
      <td>${student.name}</td>
      <td>
        <button class="btn danger mark-absent-btn" onclick="markAbsent(${student.id})">
          Mark Absent
        </button>
      </td>
    `;
    studentsList.appendChild(row);
  });
}

function displayStudentsListWithAttendance(students, attendance) {
  attendanceList.style.display = 'block';
  studentsList.innerHTML = '';
  absentStudents.clear();

  students.forEach(student => {
    const isAbsent = attendance.find(a => a.student_id === student.id && a.status === 'absent');
    if (isAbsent) {
      absentStudents.add(student.id);
    }

    const row = document.createElement('tr');
    row.id = `student-${student.id}`;
    if (isAbsent) {
      row.classList.add('absent');
    }

    row.innerHTML = `
      <td>${student.hall_ticket_number}</td>
      <td>${student.name}</td>
      <td>
        <button class="btn ${isAbsent ? 'success' : 'danger'} mark-absent-btn" onclick="markAbsent(${student.id})">
          ${isAbsent ? 'Undo Absent' : 'Mark Absent'}
        </button>
      </td>
    `;
    studentsList.appendChild(row);
  });

  // Change submit button text
  submitAttendanceButton.textContent = 'Update Attendance';
}

function markAbsent(studentId) {
  const row = document.getElementById(`student-${studentId}`);
  const button = row.querySelector('.mark-absent-btn');
  
  if (absentStudents.has(studentId)) {
    absentStudents.delete(studentId);
    row.classList.remove('absent');
    button.textContent = 'Mark Absent';
    button.classList.remove('success');
    button.classList.add('danger');
  } else {
    absentStudents.add(studentId);
    row.classList.add('absent');
    button.textContent = 'Undo Absent';
    button.classList.remove('danger');
    button.classList.add('success');
  }
}

async function handleSubmitAttendance() {
  if (!currentSessionId) {
    alert('No session selected');
    return;
  }

  try {
    const response = await fetch('/api/attendance', {
      method: isUpdateMode ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: currentSessionId,
        absentStudents: Array.from(absentStudents)
      }),
    });

    if (!response.ok) {
      throw new Error(isUpdateMode ? 'Failed to update attendance' : 'Failed to submit attendance');
    }

    alert(isUpdateMode ? 'Attendance updated successfully' : 'Attendance submitted successfully');
    
    // Reset UI
    attendanceList.style.display = 'none';
    trainingDates.style.display = 'none';
    currentSessionId = null;
    absentStudents.clear();
    currentSection = null;
    
    // Show sections list again
    sectionsList.style.display = 'grid';
    
    // Remove active class from section buttons
    document.querySelectorAll('.section-button').forEach(btn => {
      btn.classList.remove('active');
    });
  } catch (error) {
    console.error('Error:', error);
    alert(isUpdateMode ? 'Failed to update attendance' : 'Failed to submit attendance');
  }
}

// Make functions available globally
window.markAbsent = markAbsent;

// Initialize mark section by default
showSection('mark');