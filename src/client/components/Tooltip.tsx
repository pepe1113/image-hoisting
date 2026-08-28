import { useId } from "react";
import { InfoIcon } from "./icons";

export function Tooltip({ content }: { content: string }) {
  const id = useId();
  return (
    <span className="tooltip">
      <button type="button" aria-label="More information" aria-describedby={id}>
        <InfoIcon />
      </button>
      <span id={id} role="tooltip">
        {content}
      </span>
    </span>
  );
}
