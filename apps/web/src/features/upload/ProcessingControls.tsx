import { Tooltip } from "../../components/Tooltip";
import type {
  OutputFormat,
  ProcessingPreset,
  ProfilePreferences,
  SharpenLevel,
} from "../../types";
import type { UploadSession } from "./useUpload";

interface ProcessingControlsProps {
  session: UploadSession;
  preferences: ProfilePreferences;
  profileLabel: string;
}

export function ProcessingControls({
  session,
  preferences,
  profileLabel,
}: ProcessingControlsProps) {
  const {
    sourceDimensions,
    outputDimensions,
    isGif,
    effectiveOutputFormat,
    processingDisabled,
  } = session.view;
  const { setPreset, customize } = session.actions;

  return (
    <fieldset className="upload-processing">
      <legend>Processing for {profileLabel}</legend>
      <div className="processing-control">
        <span className="processing-control-label">
          <label htmlFor="processing-preset">Preset</label>
          <Tooltip
            content="Choose a starting point. Changing any setting switches the preset to Custom."
          />
        </span>
        <select
          id="processing-preset"
          value={preferences.processingPreset}
          disabled={processingDisabled}
          onChange={(event) =>
            setPreset(event.target.value as ProcessingPreset)
          }
        >
          <option value="high">High · 2048 / 85 / Mid</option>
          <option value="standard">Standard · 1600 / 80 / Low</option>
          <option value="fast">Fast · 1000 / 70 / Off</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div className="processing-sliders">
        <div className="processing-slider">
          <span className="processing-control-label">
            <label htmlFor="maximum-long-edge">Maximum long edge</label>
            <Tooltip
              content="Limits the longest edge and reduces both dimensions proportionally. Smaller images are not enlarged."
            />
            <output>{preferences.maxDimension}px</output>
          </span>
          <input
            id="maximum-long-edge"
            aria-label="Maximum long edge"
            type="range"
            min="320"
            max="8192"
            step="1"
            value={preferences.maxDimension}
            disabled={processingDisabled}
            onChange={(event) =>
              customize({ maxDimension: Number(event.target.value) })
            }
          />
        </div>
        <div className="processing-slider">
          <span className="processing-control-label">
            <label htmlFor="webp-quality">WebP quality</label>
            <Tooltip
              content="Controls lossy compression. 80–85 is a practical starting range, but the result varies by image."
            />
            <output>{preferences.quality}%</output>
          </span>
          <input
            id="webp-quality"
            aria-label="WebP quality"
            type="range"
            min="10"
            max="100"
            step="1"
            value={preferences.quality}
            disabled={processingDisabled}
            onChange={(event) =>
              customize({ quality: Number(event.target.value) })
            }
          />
        </div>
      </div>
      <div className="processing-options">
        <div className="processing-control">
          <span className="processing-control-label">
            <label htmlFor="sharpen-level">Sharpen</label>
            <Tooltip
              content="Adds subtle edge contrast after resizing to recover some apparent detail."
            />
          </span>
          <select
            id="sharpen-level"
            value={preferences.sharpen}
            disabled={processingDisabled}
            onChange={(event) =>
              customize({ sharpen: event.target.value as SharpenLevel })
            }
          >
            <option value="off">Off</option>
            <option value="low">Low</option>
            <option value="mid">Mid</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="processing-control">
          <span className="processing-control-label">
            <span id="output-format-label">Format</span>
            <Tooltip
              content="WebP is often smaller. Original keeps the file byte-for-byte and skips resizing and sharpening."
            />
          </span>
          <div
            className="format-toggle"
            role="group"
            aria-labelledby="output-format-label"
          >
            {(["original", "webp"] as const).map((format: OutputFormat) => (
              <button
                type="button"
                className={effectiveOutputFormat === format ? "is-active" : ""}
                aria-pressed={effectiveOutputFormat === format}
                disabled={isGif}
                key={format}
                onClick={() => customize({ outputFormat: format })}
              >
                {format === "original" ? "Original" : "WebP"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="processing-dimensions" aria-live="polite">
        <span>Proportional output</span>
        <strong>
          {sourceDimensions && outputDimensions
            ? `${sourceDimensions.width}×${sourceDimensions.height} → ` +
              `${outputDimensions.width}×${outputDimensions.height}px`
            : "Reading image dimensions…"}
        </strong>
        <small>
          {isGif
            ? "Animated GIF stays in its original format."
            : preferences.outputFormat === "original"
              ? "Original keeps the file byte-for-byte."
              : "The original aspect ratio is preserved."}
        </small>
      </div>
    </fieldset>
  );
}
