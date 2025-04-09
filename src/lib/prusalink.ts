import { Printer } from '@prisma/client'; // Assuming Printer type from Prisma

// Helper to construct headers with API key
const getPrusaLinkHeaders = (apiKey: string | null | undefined): Record<string, string> => {
  if (!apiKey) {
    throw new Error('PrusaLink API key is required');
  }
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey,
  };
};

// Helper to get job ID (new)
const getPrusaLinkJobId = async (printer: Printer): Promise<string | null> => {
  if (!printer.apiUrl || !printer.apiKey) {
    console.error('Printer API URL or API Key is missing for getPrusaLinkJobId');
    return null;
  }
  const url = `${printer.apiUrl}/api/v1/job`;
  const headers = getPrusaLinkHeaders(printer.apiKey);
  try {
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      console.error(`Failed to fetch PrusaLink job info for ${printer.name}. Status: ${response.status}`);
      return null;
    }
    const data = await response.json();
    // Assuming the job ID is nested like data.job.id based on typical structures
    // Adjust path if necessary based on actual printer response
    return data?.job?.id || null; 
  } catch (error) {
    console.error(`Error fetching job ID from PrusaLink ${printer.name}:`, error);
    return null;
  }
};

// Function to pause a PrusaLink print (Using v1 endpoint)
export const pausePrusaLinkPrint = async (printer: Printer, jobId: string): Promise<boolean> => {
  if (!printer.apiUrl || !printer.apiKey) {
    console.error('Printer API URL or API Key is missing for pausePrusaLinkPrint');
    return false;
  }

  const url = `${printer.apiUrl}/api/v1/job/${jobId}/pause`; // Use correct endpoint with jobId
  const headers = getPrusaLinkHeaders(printer.apiKey);

  try {
    console.log(`Sending PAUSE command (PUT) to PrusaLink: ${url}`);
    const response = await fetch(url, {
      method: 'PUT', // Use PUT method
      headers,
    });

    if (response.ok || response.status === 204) { // Check for 2xx or 204
      console.log(`PrusaLink pause command successful for ${printer.name}`);
      return true;
    } else {
      console.error(`PrusaLink pause command failed for ${printer.name}. Status: ${response.status}`);
      // Try to get error message if available
      try {
          const errorBody = await response.json();
          console.error('Error body:', errorBody);
      } catch (e) { /* Ignore if body is not JSON */ }
      return false;
    }
  } catch (error) {
    console.error(`Error sending pause command to PrusaLink ${printer.name}:`, error);
    return false;
  }
};

// Function to resume a PrusaLink print (Using v1 endpoint)
export const resumePrusaLinkPrint = async (printer: Printer, jobId: string): Promise<boolean> => {
  if (!printer.apiUrl || !printer.apiKey) {
    console.error('Printer API URL or API Key is missing for resumePrusaLinkPrint');
    return false;
  }

  const url = `${printer.apiUrl}/api/v1/job/${jobId}/resume`; // Use correct endpoint with jobId
  const headers = getPrusaLinkHeaders(printer.apiKey);

  try {
    console.log(`Sending RESUME command (PUT) to PrusaLink: ${url}`);
    const response = await fetch(url, {
      method: 'PUT', // Use PUT method
      headers,
    });

    if (response.ok || response.status === 204) { // Check for 2xx or 204
      console.log(`PrusaLink resume command successful for ${printer.name}`);
      return true;
    } else {
      console.error(`PrusaLink resume command failed for ${printer.name}. Status: ${response.status}`);
      try {
          const errorBody = await response.json();
          console.error('Error body:', errorBody);
      } catch (e) { /* Ignore */ }
      return false;
    }
  } catch (error) {
    console.error(`Error sending resume command to PrusaLink ${printer.name}:`, error);
    return false;
  }
};

// Function to cancel a PrusaLink print (Using v1 endpoint)
export const cancelPrusaLinkPrint = async (printer: Printer, jobId: string): Promise<boolean> => {
  if (!printer.apiUrl || !printer.apiKey) {
    console.error('Printer API URL or API Key is missing for cancelPrusaLinkPrint');
    return false;
  }

  const url = `${printer.apiUrl}/api/v1/job/${jobId}`; // Use correct endpoint with jobId
  const headers = getPrusaLinkHeaders(printer.apiKey);

  try {
    console.log(`Sending CANCEL command (DELETE) to PrusaLink: ${url}`);
    const response = await fetch(url, {
      method: 'DELETE', // Use DELETE method
      headers,
    });

    if (response.ok || response.status === 204) { // Check for 2xx or 204
      console.log(`PrusaLink cancel command successful for ${printer.name}`);
      return true;
    } else {
      console.error(`PrusaLink cancel command failed for ${printer.name}. Status: ${response.status}`);
      try {
          const errorBody = await response.json();
          console.error('Error body:', errorBody);
      } catch (e) { /* Ignore if body is not JSON */ }
      return false;
    }
  } catch (error) {
    console.error(`Error sending cancel command to PrusaLink ${printer.name}:`, error);
    return false;
  }
}; 