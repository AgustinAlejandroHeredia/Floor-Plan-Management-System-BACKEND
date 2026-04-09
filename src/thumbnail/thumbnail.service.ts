export abstract class ThumbnailService {

    abstract createThumbnail(fileBuffer: Buffer): Promise<Buffer>

      getThumbnailName(originalName: string): string {
        const extIndex = originalName.lastIndexOf(".");

        if (extIndex === -1) {
        return `${originalName}_thumbnail`; // fallback raro pero seguro
        }

        const name = originalName.substring(0, extIndex);
        const ext = originalName.substring(extIndex);

        // ⚠️ importante si usás sharp.jpeg()
        return `${name}_thumbnail.jpg`;
    }

}