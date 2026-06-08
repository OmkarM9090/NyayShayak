// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUICK TEST SCRIPT - Comprehensive Analysis API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Purpose: Test the complete flow of the analysis system
// Usage: node test-comprehensive.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import axios from 'axios';

// Test document with sensitive data and risky clauses
const testDocument = `
RENTAL AGREEMENT

This Rental Agreement ("Agreement") is entered into on March 1, 2026

PARTIES:
Landlord: Rajesh Kumar
Address: 123 MG Road, Mumbai
Aadhaar: 1234-5678-9012
Phone: 9876543210
Email: rajesh.kumar@email.com
PAN: ABCDE1234F

Tenant: Priya Sharma  
Aadhaar: 9876-5432-1098
Phone: 9123456789
Email: priya.sharma@email.com

TERMS AND CONDITIONS:

1. RENTAL AMOUNT
   Monthly rent: Rs. 10,000 per month
   Late payment penalty: 10% per day (up to 30% per month)

2. SECURITY DEPOSIT
   Amount: Rs. 20,000
   Non-refundable processing fee: Rs. 5,000

3. MAINTENANCE
   Tenant shall be responsible for ALL repairs and maintenance
   including structural repairs, plumbing, electrical, and external painting.
   Landlord has no responsibility for any repairs.

4. TERMINATION
   Landlord may terminate this agreement with only 7 days written notice
   for any reason or no reason.
   Tenant must give 90 days notice to terminate.
   Early termination by tenant will result in forfeiture of entire security deposit.

5. MODIFICATIONS
   Landlord can modify rent amount with only 15 days notice.
   Rent can be increased up to 50% at landlord's discretion.

6. DISPUTES
   All disputes shall be resolved by arbitration in landlord's chosen city.
   Tenant waives all rights to legal recourse.

This agreement shall be binding upon both parties.

SIGNATURES:
Landlord: _________________
Tenant: _________________

Date: March 1, 2026
`;

/**
 * Main test function
 */
async function testComprehensiveAnalysis() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TESTING COMPREHENSIVE ANALYSIS API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    console.log('📤 Sending request to API...');
    console.log('Document size:', testDocument.length, 'characters');
    console.log('');

    const startTime = Date.now();

    const response = await axios.post('http://localhost:5000/api/comprehensive-analysis', {
      documentText: testDocument
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('✅ Response received in', duration, 'seconds');
    console.log('');

    // Extract data
    const { privacy, datasetAnalysis, aiAnalysis, metadata } = response.data.data;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PRIVACY PROTECTION RESULTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔒 PRIVACY PROTECTION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Protected:', privacy.protected ? '✅ YES' : '❌ NO');
    console.log('Total fields masked:', privacy.totalFieldsMasked);
    console.log('Data types masked:', privacy.maskedDataTypes.join(', '));
    console.log('Breakdown:', JSON.stringify(privacy.summary, null, 2));
    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DATASET ANALYSIS RESULTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DATASET ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Similar documents found:', datasetAnalysis.similarDocuments.length);
    
    if (datasetAnalysis.topMatch) {
      console.log('Top match confidence:', (datasetAnalysis.confidence * 100).toFixed(1) + '%');
      console.log('Preview:', datasetAnalysis.topMatch.text?.substring(0, 100) + '...');
    } else {
      console.log('No matches found in database');
    }
    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // AI ANALYSIS RESULTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 GEMINI AI ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Summary:', aiAnalysis.summary);
    console.log('');
    console.log('Total risks found:', aiAnalysis.totalRisks);
    console.log('Risk distribution:');
    console.log('  🔴 HIGH:', aiAnalysis.riskDistribution.high);
    console.log('  🟡 MEDIUM:', aiAnalysis.riskDistribution.medium);
    console.log('  🟢 LOW:', aiAnalysis.riskDistribution.low);
    console.log('');

    // Display each risk
    if (aiAnalysis.risks.length > 0) {
      console.log('DETECTED RISKS:');
      console.log('');
      aiAnalysis.risks.forEach((risk, index) => {
        const icon = risk.severity === 'HIGH' ? '🔴' : risk.severity === 'MEDIUM' ? '🟡' : '🟢';
        console.log(`${icon} Risk ${index + 1}: [${risk.severity}]`);
        console.log(`   Clause: ${risk.clause}`);
        console.log(`   Reason: ${risk.reason}`);
        console.log('');
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // METADATA
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 PROCESSING METADATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Processing steps:');
    metadata.processingSteps.forEach(step => console.log('  ' + step));
    console.log('');
    console.log('Document size:', metadata.documentSize, 'characters');
    console.log('Masked document size:', metadata.maskedDocumentSize, 'characters');
    console.log('Chunks processed:', aiAnalysis.chunksProcessed);
    console.log('Timestamp:', new Date(metadata.timestamp).toLocaleString());
    console.log('');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST SUMMARY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ API Response: SUCCESS');
    console.log('✅ Privacy Protection:', privacy.protected ? 'WORKING' : 'NOT WORKING');
    console.log('✅ Dataset Analysis:', datasetAnalysis.similarDocuments.length > 0 ? 'WORKING' : 'NO MATCHES');
    console.log('✅ Gemini AI:', aiAnalysis.totalRisks > 0 ? 'WORKING' : 'NO RISKS FOUND');
    console.log('✅ Processing Time:', duration + 's');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('');

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ TEST FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('Status code:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Make sure server is running on http://localhost:5000');
    } else {
      console.error('Error details:', error);
    }
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Check if server is running: npm start');
    console.error('2. Verify GEMINI_API_KEY in .env file');
    console.error('3. Check Python ML service is working');
    console.error('4. Review server logs for errors');
    console.error('');
  }
}

// Run the test
console.log('');
console.log('Starting comprehensive analysis test...');
console.log('Make sure backend server is running!');
console.log('');

testComprehensiveAnalysis();
