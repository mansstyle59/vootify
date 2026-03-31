import { forwardRef, type ImgHTMLAttributes } from "react";

/**
 * Drop-in `<img>` replacement that always applies `referrerPolicy="no-referrer"`
 * to prevent hotlink/CORS blocking from external CDNs (Deezer, etc.).
 */
const SafeImage = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  ({ referrerPolicy = "no-referrer", decoding = "async", ...props }, ref) => (
    <img ref={ref} referrerPolicy={referrerPolicy} decoding={decoding} {...props} />
  )
);

SafeImage.displayName = "SafeImage";

export { SafeImage };
