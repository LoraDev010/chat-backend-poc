import { ENV } from '../../src/config/env';
import { socketConfig } from '../../src/config/socket';

describe('ENV', () => {
  it('should have default PORT 3000', () => {
    expect(ENV.PORT).toBe(3000);
  });

  it('should have CORS_ORIGIN', () => {
    expect(typeof ENV.CORS_ORIGIN).toBe('string');
  });
});

describe('socketConfig', () => {
  it('should have cors origin from ENV', () => {
    expect(socketConfig.cors).toEqual({ origin: ENV.CORS_ORIGIN });
  });

  it('should have maxHttpBufferSize', () => {
    expect(socketConfig.maxHttpBufferSize).toBe(1e6);
  });
});
