import { BlobServiceClient } from "@azure/storage-blob";

export class StorageService {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
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