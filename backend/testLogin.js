const axios = require('axios');
const { expect } = require('chai');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api/auth';

// Use existing management credentials from your seed data
const MANAGEMENT_CREDENTIALS = {
  domain_id: 'admin1', 
  password: 'admin123'
};

describe('Authentication Tests', function() {
  this.timeout(10000); // Increased timeout

  let managementToken;

  before(async function() {
    try {
      // First verify the test user exists
      console.log('Attempting to login with:', MANAGEMENT_CREDENTIALS);
      
      const res = await axios.post(`${API_BASE_URL}/login`, MANAGEMENT_CREDENTIALS);
      managementToken = res.data.token;
      console.log('Login successful, token received');
    } catch (error) {
      console.error('Login failed:', error.response?.data || error.message);
      throw error;
    }
  });

  it('should register and login a new student', async function() {
    const studentData = {
      domain_id: `student_${uuidv4().substring(0, 8)}`,
      password: 'test1234',
      role: 'student',
      name: 'Test Student',
      email: `student_${uuidv4().substring(0, 8)}@test.com`,
      phone_number: '1234567890',
      roll_number: `ROLL_${uuidv4().substring(0, 6)}`,
      address: '123 Test Street'
    };

    // Register with management token
    const registerResponse = await axios.post(
      `${API_BASE_URL}/register`, 
      studentData, 
      {
        headers: { Authorization: `Bearer ${managementToken}` }
      }
    );
    expect(registerResponse.status).to.equal(201);

    // Test login
    const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
      domain_id: studentData.domain_id,
      password: studentData.password
    });
    expect(loginResponse.status).to.equal(200);
    expect(loginResponse.data.token).to.exist;
  });
});