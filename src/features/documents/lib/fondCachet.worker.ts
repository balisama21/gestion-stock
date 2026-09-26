import { supprimerFond, type ImagePixels, type OptionsFond } from "./fondCachet";

self.onmessage = (e: MessageEvent<{ image: ImagePixels; options: OptionsFond }>) => {
  const res = supprimerFond(e.data.image, e.data.options);
  (self as unknown as Worker).postMessage(res, [res.image.data.buffer]);
};
