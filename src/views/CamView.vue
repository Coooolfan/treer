<script setup lang="ts">
import { onMounted, ref } from 'vue'

const videoElement = ref<HTMLVideoElement | null>(null)
const canvasElement = ref<HTMLCanvasElement | null>(null)
const cameras = ref<MediaDeviceInfo[]>([])
const selectedCameraId = ref<string | null>(null)
let animationFrameId: number | null = null

async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((device) => device.kind === 'videoinput')
}
async function startCameraStream() {
  const deviceId = selectedCameraId.value?.toString() || ''
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
  })

  if (videoElement.value) {
    videoElement.value.srcObject = stream
    videoElement.value.play()
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }

  drawToCanvas()
}
function drawToCanvas() {
  if (videoElement.value && canvasElement.value) {
    const context = canvasElement.value.getContext('2d')
    if (context) {
      context.drawImage(
        videoElement.value,
        0,
        0,
        canvasElement.value.width,
        canvasElement.value.height,
      )
    }
  }
  animationFrameId = requestAnimationFrame(drawToCanvas)
}
onMounted(async () => {
  cameras.value = await getCameraDevices()
  if (cameras.value.length > 0) {
    selectedCameraId.value = cameras.value[0].deviceId
    await startCameraStream()
  }
})
</script>
<template>
  <div class="cav1">
    <video ref="videoElement" style="display: none"></video>
    <canvas ref="canvasElement" id="output" width="640" height="480"></canvas>
  </div>
  <div class="toolbar">
    <select v-model="selectedCameraId">
      <option v-for="camera in cameras" :key="camera.deviceId" :value="camera.deviceId">
        {{ camera.label }}
      </option>
    </select>
    <div class="toolbarItem">
      <button @click="startCameraStream">展示</button>
    </div>
  </div>
</template>

<style scoped>
.cavBar {
  display: flex;
}
.cav1 {
  height: 90vh;
  width: 100vw;
  background-color: #f78b3d;
}
.toolbar {
  width: 100vw;
  display: flex;
}

.toolbarItem {
  height: 10vh;
  background-color: #f2f2f2;
}
button {
  margin: 10px;
  width: 100px;
  height: 40px;
  font-size: large;
  padding: 5px 10px;
  border-radius: 5px;
  background-color: #f78b3d;
  color: #fff;
  border: none;
  cursor: pointer;
}
</style>
