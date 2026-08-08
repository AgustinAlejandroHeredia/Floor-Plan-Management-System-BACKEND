import { promises as fs } from 'fs';
import { ModelService } from './model.service';

describe('ModelService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears the previous default model when a new default is assigned for the same task/specialty', async () => {
    const service = new ModelService();
    const existingModels = [
      {
        id: 'model-a',
        name: 'First model',
        task: 'object detection',
        AEC_speciality: 'architecture',
        defaultModel: true,
        defaultFor: 'object detection:architecture',
      },
      {
        id: 'model-b',
        name: 'Second model',
        task: 'object detection',
        AEC_speciality: 'architecture',
        defaultModel: false,
      },
    ];

    jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({ models: existingModels }));
    const writeSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'rename').mockResolvedValue(undefined);

    const updated = await service.updateModel('model-b', {
      id: 'model-b',
      task: 'object detection',
      AEC_speciality: 'architecture',
      defaultModel: true,
      defaultFor: 'object detection:architecture',
    });

    expect(updated.defaultModel).toBe(true);
    expect(updated.defaultFor).toBe('object detection:architecture');

    const writtenPayload = JSON.parse(writeSpy.mock.calls[0][1] as string);
    expect(writtenPayload.models[0].defaultModel).toBe(false);
    expect(writtenPayload.models[0].defaultFor).toBeUndefined();
    expect(writtenPayload.models[1].defaultModel).toBe(true);
    expect(writtenPayload.models[1].defaultFor).toBe('object detection:architecture');
  });
});
