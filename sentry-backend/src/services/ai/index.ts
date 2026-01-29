import { dataDiscoveryService } from './data-discovery';
import { autoMLService } from './auto-ml';
import { goldLayerService } from './gold-layer';

export const aiService = {
    ...dataDiscoveryService,
    ...autoMLService,
    ...goldLayerService
};

export { dataDiscoveryService, autoMLService, goldLayerService };
