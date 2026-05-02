const fileInput = document.querySelector("#audio-file");
const dropZone = document.querySelector("#drop-zone");
const fileLabel = document.querySelector("#file-label");
const slowdown = document.querySelector("#slowdown");
const slowdownOutput = document.querySelector("#slowdown-output");
const slowdownDown = document.querySelector("#slowdown-down");
const slowdownUp = document.querySelector("#slowdown-up");
const targetMinutes = document.querySelector("#target-minutes");
const targetSeconds = document.querySelector("#target-seconds");
const originalLength = document.querySelector("#original-length");
const previewButton = document.querySelector("#preview-button");
const downloadLink = document.querySelector("#download-link");
const statusText = document.querySelector("#status-text");
const progress = document.querySelector("#progress");
const player = document.querySelector("#player");

let sourceBuffer = null;
let sourceFileName = "slowed-track";
let renderedUrl = null;

const setStatus = (message, progressValue = null) => {
  statusText.textContent = message;

  if (progressValue === null) {
    progress.hidden = true;
    progress.value = 0;
    return;
  }

  progress.hidden = false;
  progress.value = progressValue;
};

const formatPercent = (value) => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

const updateSlowdownLabel = () => {
  slowdownOutput.value = `${formatPercent(Number(slowdown.value))}%`;
  slowdownDown.disabled = Number(slowdown.value) <= Number(slowdown.min);
  slowdownUp.disabled = Number(slowdown.value) >= Number(slowdown.max);
};

const getTargetDurationInSeconds = () =>
  Number(targetMinutes.value || 0) * 60 + Number(targetSeconds.value || 0);

const setTargetDurationFields = (durationInSeconds) => {
  const safeDuration = Math.max(0, Math.round(durationInSeconds));
  targetMinutes.value = String(Math.floor(safeDuration / 60));
  targetSeconds.value = String(safeDuration % 60);
};

const syncTargetDurationFromSlider = () => {
  if (!sourceBuffer) {
    return;
  }

  setTargetDurationFields(sourceBuffer.duration * (Number(slowdown.value) / 100));
};

const handleSlowdownChange = () => {
  updateSlowdownLabel();
  syncTargetDurationFromSlider();
  if (sourceBuffer) {
    revokeRenderedUrl();
    setStatus("Setting changed. Render a fresh preview.");
  }
};

const stepSlowdown = (direction) => {
  const nextValue = Number(slowdown.value) + direction * Number(slowdown.step);
  const clampedValue = Math.max(Number(slowdown.min), Math.min(Number(slowdown.max), nextValue));
  slowdown.value = String(clampedValue);
  handleSlowdownChange();
};

const revokeRenderedUrl = () => {
  if (renderedUrl) {
    URL.revokeObjectURL(renderedUrl);
    renderedUrl = null;
  }

  player.removeAttribute("src");
  player.load();
  downloadLink.removeAttribute("href");
  downloadLink.classList.add("disabled");
  downloadLink.setAttribute("aria-disabled", "true");
};

const getBaseName = (name) => name.replace(/\.[^/.]+$/, "") || "slowed-track";

const enableTargetDurationInputs = (enabled) => {
  targetMinutes.disabled = !enabled;
  targetSeconds.disabled = !enabled;
};

const loadAudioFile = async (file) => {
  if (!file || !file.type.startsWith("audio/")) {
    setStatus("Choose an audio file to begin.");
    return;
  }

  previewButton.disabled = true;
  revokeRenderedUrl();
  sourceFileName = getBaseName(file.name);
  fileLabel.textContent = file.name;
  setStatus("Decoding your track...", 20);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    sourceBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();

    previewButton.disabled = false;
    enableTargetDurationInputs(true);
    originalLength.textContent = `Original length: ${formatDuration(sourceBuffer.duration)}`;
    syncTargetDurationFromSlider();
    const seconds = formatDuration(sourceBuffer.duration);
    setStatus(`Ready. Original length: ${seconds}.`);
  } catch (error) {
    sourceBuffer = null;
    fileLabel.textContent = "Try another browser-supported audio file";
    enableTargetDurationInputs(false);
    originalLength.textContent = "Load a track to enable exact timing";
    setStatus("That file could not be decoded here. Try WAV, MP3, M4A, OGG, or FLAC.");
    console.error(error);
  }
};

const renderSlowedBuffer = async (buffer, slowdownPercent) => {
  const factor = slowdownPercent / 100;
  const sampleRate = buffer.sampleRate;
  const targetLength = Math.ceil(buffer.length * factor);
  const rendered = new AudioBuffer({
    length: targetLength,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate,
  });

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const input = buffer.getChannelData(channel);
    const output = rendered.getChannelData(channel);

    for (let index = 0; index < targetLength; index += 1) {
      const sourceIndex = index / factor;
      const before = Math.floor(sourceIndex);
      const after = Math.min(before + 1, input.length - 1);
      const blend = sourceIndex - before;
      output[index] = input[before] * (1 - blend) + input[after] * blend;
    }
  }

  return rendered;
};

const audioBufferToWav = (buffer) => {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);
  const channels = Array.from({ length: numberOfChannels }, (_, channel) =>
    buffer.getChannelData(channel),
  );

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let index = 0; index < buffer.length; index += 1) {
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][index]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
};

const writeString = (view, offset, value) => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

const formatDuration = (duration) => {
  const rounded = Math.max(0, Math.round(duration));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const applyTargetDuration = () => {
  if (!sourceBuffer) {
    return false;
  }

  const requestedDuration = getTargetDurationInSeconds();
  if (!Number.isFinite(requestedDuration) || requestedDuration <= 0) {
    setStatus("Enter a target length greater than zero.");
    return false;
  }

  const unclampedPercent = (requestedDuration / sourceBuffer.duration) * 100;
  const clampedPercent = Math.max(Number(slowdown.min), Math.min(Number(slowdown.max), unclampedPercent));
  slowdown.value = clampedPercent.toFixed(2);
  updateSlowdownLabel();

  if (renderedUrl) {
    revokeRenderedUrl();
  }

  if (clampedPercent !== unclampedPercent) {
    setTargetDurationFields(sourceBuffer.duration * (clampedPercent / 100));
    setStatus("Target length was clamped to the supported slowdown range.");
  } else {
    setStatus("Target length updated. Render a fresh preview.");
  }

  return true;
};

const renderPreview = async () => {
  if (!sourceBuffer) {
    return;
  }

  if (!applyTargetDuration()) {
    return;
  }

  previewButton.disabled = true;
  revokeRenderedUrl();
  const percent = Number(slowdown.value);
  const factor = percent / 100;
  const newLength = formatDuration(sourceBuffer.duration * factor);
  setStatus(`Rendering ${percent}% slowdown. New length: ${newLength}.`, 45);

  try {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const slowedBuffer = await renderSlowedBuffer(sourceBuffer, percent);
    setStatus("Preparing preview and download...", 82);
    const wav = audioBufferToWav(slowedBuffer);
    renderedUrl = URL.createObjectURL(wav);

    player.src = renderedUrl;
    downloadLink.href = renderedUrl;
    downloadLink.download = `${sourceFileName}-${percent}-percent-slower.wav`;
    downloadLink.classList.remove("disabled");
    downloadLink.setAttribute("aria-disabled", "false");
    setStatus(`Preview ready. Download size: ${formatBytes(wav.size)}.`);
  } catch (error) {
    setStatus("Rendering failed. Try a shorter file or a smaller slowdown setting.");
    console.error(error);
  } finally {
    previewButton.disabled = false;
  }
};

const formatBytes = (bytes) => {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

fileInput.addEventListener("change", (event) => {
  loadAudioFile(event.target.files[0]);
});

slowdown.addEventListener("input", handleSlowdownChange);
slowdownDown.addEventListener("click", () => stepSlowdown(-1));
slowdownUp.addEventListener("click", () => stepSlowdown(1));
targetMinutes.addEventListener("input", () => {
  if (!sourceBuffer) {
    return;
  }

  applyTargetDuration();
});
targetSeconds.addEventListener("input", () => {
  if (!sourceBuffer) {
    return;
  }

  const normalizedSeconds = Math.max(0, Math.min(59, Number(targetSeconds.value || 0)));
  targetSeconds.value = String(normalizedSeconds);
  applyTargetDuration();
});

previewButton.addEventListener("click", renderPreview);

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, () => {
    dropZone.classList.remove("dragging");
  });
}

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  loadAudioFile(file);
});

updateSlowdownLabel();
enableTargetDurationInputs(false);
