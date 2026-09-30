// Logical candidate IDs only; the scene adapter must supply authored, safe positions.
export const sampleDefinitions = {
  schemaVersion: 1, rulesVersion: 'DEV-C-1',
  anchors: [
    { id: 'Z0-HERB-01', planetId: 'P1', zoneId: 'Z0', kind: 'resource',
      cooldown: [720, 1200], offlineCredit: true, populationCap: 6,
      qualityProfileId: 'HERB-R0-V1',
      combinations: [
        { id: 'shallows', family: 'basic-herb', count: 3, layout: 'shallows', route: 'root', appearance: 'a', weight: 1 },
        { id: 'tributary', family: 'basic-herb', count: 4, layout: 'tributary', route: 'root', appearance: 'b', weight: 1 },
      ] },
    { id: 'Z0-LAIR-01', planetId: 'P1', zoneId: 'Z0', kind: 'monster',
      cooldown: [480, 720], offlineCredit: true, populationCap: 3,
      lootProfileId: 'BIO-R0-NORMAL-V1',
      combinations: [
        { id: 'east-pair', family: 'M00', count: 2, layout: 'east-entry', route: 'east-patrol', appearance: 'a', weight: 1 },
        { id: 'north-trio', family: 'M00', count: 3, layout: 'north-entry', route: 'north-patrol', appearance: 'b', weight: 1 },
      ] },
  ],
};
