import { BlobServiceClient } from "@azure/storage-blob";

// Mock version of BlobServiceClient interfaces for environments without Azure credentials
class MockBlockBlobClient {
  url: string;
  
  constructor(url: string) {
    this.url = url;
  }
  
  async upload(data: Buffer, length: number): Promise<any> {
    console.log(`[MOCK] Uploading ${length} bytes to ${this.url}`);
    return { etag: "mock-etag" };
  }
  
  async delete(): Promise<any> {
    console.log(`[MOCK] Deleting blob at ${this.url}`);
    return {};
  }
}

class MockContainerClient {
  name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  getBlockBlobClient(blobName: string): MockBlockBlobClient {
    return new MockBlockBlobClient(`https://mock-storage/${this.name}/${blobName}`);
  }
}

class MockBlobServiceClient {
  url: string;
  
  constructor(url: string) {
    this.url = url;
  }
  
  getContainerClient(containerName: string): MockContainerClient {
    return new MockContainerClient(containerName);
  }
  
  static fromConnectionString(connectionString: string): MockBlobServiceClient {
    return new MockBlobServiceClient("https://mock.blob.core.windows.net");
  }
}

export class StorageService {
  private blobServiceClient: BlobServiceClient | MockBlobServiceClient;
  private containerName: string;
  private isMock: boolean = false;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'default-container';
    
    if (!connectionString) {
      console.warn('Azure Storage connection string not found, using mock storage service');
      this.blobServiceClient = MockBlobServiceClient.fromConnectionString('mock');
      this.isMock = true;
    } else {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    }
  }

  async uploadFile(file: Buffer, fileName: string, userId: string): Promise<string> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blobName = `${userId}/${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(file, file.length);
    return blockBlobClient.url;
  }

  async deleteFile(fileName: string, userId: string): Promise<void> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blobName = `${userId}/${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.delete();
  }

  async getFileUrl(fileName: string, userId: string): Promise<string> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blobName = `${userId}/${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    return blockBlobClient.url;
  }
} 