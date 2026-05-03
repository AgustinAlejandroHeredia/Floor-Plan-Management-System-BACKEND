import { Injectable } from '@nestjs/common';
import { CreateAiProcessingDto } from './dto/create-ai-processing.dto';
import { SectionView } from './common/types';

@Injectable()
export class AiProcessingService {
  
  async processBlueprint(){
    
  }

  async getExampleShapes(): Promise<SectionView[]>{
    // POLIGONO
    const polygon: SectionView = {
        type: "polygon",
        size: { width: 0, height: 0 },
        coordsList: [
            { x: 30, y: 30 },
            { x: 60, y: 35 },
            { x: 70, y: 60 },
            { x: 50, y: 80 },
            { x: 20, y: 70 },
        ],
    }

    // RECTANGLE
    const rectangle: SectionView = {
        type: "rectangle",
        size: { width: 0, height: 0 },
        coordsList: [
            { x: 100, y: 40 }, // top left
            { x: 180, y: 120 }, // bottom right
        ],
    }

    // CIRCULO
    const circle: SectionView = {
        type: "circle",
        coordsList: [
            { x: 200, y: 150 }, // circle center coord set
        ],
        radius: 40,
        size: { width: 0, height: 0 },
    }

    // POLYLINE
    const polyline: SectionView = {
        type: "polyline",
        size: { width: 0, height: 0 },
        coordsList: [
            { x: 250, y: 50 },
            { x: 280, y: 80 },
            { x: 260, y: 120 },
            { x: 300, y: 140 },
        ],
    }

    return [polygon, rectangle, circle, polyline]
  }

}
