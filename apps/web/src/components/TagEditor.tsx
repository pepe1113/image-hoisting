import { useState, type KeyboardEvent } from "react";
import { MAX_TAG_LENGTH, MAX_TAGS, parseTagInput } from "../core";
import { CloseIcon } from "./icons";

interface TagEditorProps {
  tags: string[];
  maxTags?: number;
  maxTagLength?: number;
  onChange: (tags: string[]) => void;
}

export function TagEditor({
  tags,
  maxTags = MAX_TAGS,
  maxTagLength = MAX_TAG_LENGTH,
  onChange,
}: TagEditorProps) {
  const [input, setInput] = useState("");

  function commit(value = input): void {
    const next = parseTagInput([...tags, ...parseTagInput(value)].join(","));
    if (
      next.length <= maxTags &&
      next.every((tag) => tag.length <= maxTagLength)
    ) {
      onChange(next);
      setInput("");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (["Enter", ",", "，"].includes(event.key)) {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <span className="tag-editor">
      <span className="tag-badge-list">
        {tags.map((tag) => (
          <span className="tag-badge" key={tag}>
            {tag}
            <button
              type="button"
              aria-label={`Remove tag: ${tag}`}
              onClick={() => onChange(tags.filter((item) => item !== tag))}
            >
              <CloseIcon />
            </button>
          </span>
        ))}
      </span>
      <input
        value={input}
        onChange={(event) => {
          const value = event.target.value;
          if (/[,，]/u.test(value)) {
            const parts = value.split(/[,，]/u);
            const unfinished = parts.pop() ?? "";
            commit(parts.join(","));
            setInput(unfinished);
          } else {
            setInput(value);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => commit()}
        placeholder="Type and press Enter or comma"
      />
    </span>
  );
}
