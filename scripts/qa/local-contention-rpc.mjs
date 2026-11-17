import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const firestoreRequire = createRequire(require.resolve('@google-cloud/firestore'));
const gaxRequire = createRequire(firestoreRequire.resolve('google-gax'));
const { Client, InterceptingCall } = gaxRequire('@grpc/grpc-js');

export function observeLocalTransactionRpc(context, events) {
  const original = Client.prototype.checkMetadataAndOptions;
  Client.prototype.checkMetadataAndOptions = function (...args) {
    const checked = original.apply(this, args), operation = context.getStore();
    const observer = (options, nextCall) => new InterceptingCall(nextCall(options), {
      start(metadata, listener, next) {
        next(metadata, {
          onReceiveStatus(status, forward) {
            const { code, details } = status;
            events.push({ operation: operation ?? 'sdk-transport', method: options.method_definition.path, code, details });
            forward(status);
          },
        });
      },
    });
    return { ...checked, options: { ...checked.options,
      interceptors: [...(checked.options.interceptors ?? []), observer] } };
  };
  return () => { Client.prototype.checkMetadataAndOptions = original; };
}
