document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const studentProfile = document.querySelector('.student-profile');

  async function fetchStudentProfile(searchTerm) {
    try {
      console.log('Fetching student profile for:', searchTerm);
      
      const response = await fetch(`/api/students/search?q=${encodeURIComponent(searchTerm)}`);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch student profile');
      }

      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data;
    } catch (error) {
      console.error('Error in fetchStudentProfile:', error);
      throw error;
    }
  }

  function updateStudentProfile(student) {
    console.log('Updating profile with student data:', student);
    
    if (!student) {
      console.error('No student data received');
      throw new Error('No student data received');
    }

    studentProfile.style.display = 'block';
    document.querySelector('.profile-details h2').textContent = `Student Details - ${student.name}`;
    
    const detailsGrid = document.querySelector('.details-grid');
    detailsGrid.innerHTML = `
      <div class="detail-item">
        <label>Hall Ticket No:</label>
        <span>${student.hall_ticket_number || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <label>Name:</label>
        <span>${student.name || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <label>Year:</label>
        <span>${student.year ? `${student.year}th Year` : 'N/A'}</span>
      </div>
      <div class="detail-item">
        <label>Branch:</label>
        <span>${student.branch || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <label>Section:</label>
        <span>${student.section || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <label>Degree:</label>
        <span>${student.degree || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <label>Gender:</label>
        <span>${student.gender || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <label>Date of Birth:</label>
        <span>${student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : 'N/A'}</span>
      </div>
      <div class="detail-item">
        <label>10th Percentage:</label>
        <span>${student.tenth_percentage ? `${student.tenth_percentage}%` : 'N/A'}</span>
      </div>
      <div class="detail-item">
        <label>Inter Percentage:</label>
        <span>${student.inter_percentage ? `${student.inter_percentage}%` : 'N/A'}</span>
      </div>
      <div class="detail-item">
        <label>CGPA:</label>
        <span>${student.cgpa || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <label>Backlogs:</label>
        <span>${student.backlogs !== undefined ? student.backlogs : 'N/A'}</span>
      </div>
    `;
    console.log('Profile updated successfully');
  }

  async function handleSearch() {
    const searchTerm = searchInput.value.trim();
    console.log('Search initiated for term:', searchTerm);
    
    if (!searchTerm) {
      console.log('Empty search term');
      alert('Please enter a Hall Ticket Number or Full Name');
      return;
    }

    try {
      const student = await fetchStudentProfile(searchTerm);
      updateStudentProfile(student);
    } catch (error) {
      console.error('Search error:', error);
      alert(error.message || 'Failed to fetch student profile. Please try again.');
      studentProfile.style.display = 'none';
    }
  }

  searchButton.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });
});