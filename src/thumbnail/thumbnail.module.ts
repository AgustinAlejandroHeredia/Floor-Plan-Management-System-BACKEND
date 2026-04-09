import { Module } from '@nestjs/common';
import { ThumbnailService } from './thumbnail.service';
import { SharpService } from './sharp/sharp.service';

@Module({
    imports: [],
    providers: [
        {
            provide: ThumbnailService,
            useClass: SharpService,
        },
    ],
    exports: [ThumbnailService]
})
export class ThumbnailModule {}