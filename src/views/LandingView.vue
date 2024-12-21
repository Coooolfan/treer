<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { BasicShadowMap, SRGBColorSpace, NoToneMapping } from 'three'

import ChristmasTree from '../components/ChristmasTree.vue'
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { getDistance } from '@/Utils'

const positionScale = 100 // 用于调整位置的缩放因子
const senceScale = 1000   // 用于调整场景整体大小的缩放因子

const videoElement = ref<HTMLVideoElement | null>(null)
const christmasTreeRef = ref<InstanceType<typeof ChristmasTree> | null>(null)
const cameras = ref<MediaDeviceInfo[]>([])
const selectedCameraId = ref<string | null>(null)
const orientation = ref<'portrait' | 'landscape' | 'unknown'>('portrait') // 默认为竖屏
let gestureRecognizer: GestureRecognizer | null = null
const gestureRecognizerLoaded = ref(false)
let handLandmarkerResult: HandLandmarkerResult | null = null
const msg = ref('')
// const debugMsg = ref('')
const isDetecting = ref(false)

async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await window.navigator.mediaDevices.enumerateDevices()
  return devices.filter((device) => device.kind === 'videoinput')
}

function syncObjectLocation() {
  if (videoElement.value) {
    const videoWidth = videoElement.value.videoWidth
    const videoHeight = videoElement.value.videoHeight
    let center_x = 0, center_y = 0
    
    // 绘制手部检测结果
    if (handLandmarkerResult) {
      if (handLandmarkerResult.handedness.length === 0) {
        msg.value = '未检测到手'
        window.requestAnimationFrame(syncObjectLocation)
        return
      }
      const [landmark0, landmark5, landmark17] = [
        handLandmarkerResult.landmarks[0][0],
        handLandmarkerResult.landmarks[0][5],
        handLandmarkerResult.landmarks[0][17],
      ]
      center_x = ((landmark0.x + landmark5.x + landmark17.x) / 3) * videoWidth
      center_y = ((landmark0.y + landmark5.y + landmark17.y) / 3) * videoHeight

      // 获取手部关键点
      const center_z = (landmark0.z + landmark5.z + landmark17.z) / 3

      // 调整模型位置
      if (christmasTreeRef.value?.boxRef) {
        const boxRef = christmasTreeRef.value.boxRef
        if (boxRef) {
          // 使用更合适的缩放因子
          const positionScaleFactor = orientation.value === 'landscape' ? 20 : 60
          boxRef.position.x = (center_x - videoWidth / 2) / positionScaleFactor
          boxRef.position.y = center_z * 20  // 保持 y 轴控制不变
          boxRef.position.z = (center_y - videoHeight / 2) / positionScaleFactor
        }
      }

      // 调整模型缩放
      const avgDistance = (getDistance(landmark0, landmark5) + 
        getDistance(landmark17, landmark5) + 
        getDistance(landmark0, landmark17)) / 3
      const scaleFactor = orientation.value === 'landscape' ? 0.2 : 0.5
      if (christmasTreeRef.value?.setScale) {
        christmasTreeRef.value.setScale(
          avgDistance / scaleFactor,
          avgDistance / scaleFactor,
          avgDistance / scaleFactor,
        )
      }
    }
  }
  window.requestAnimationFrame(syncObjectLocation)
}

function checkOrientation() {
  orientation.value = getDeviceOrientation()
}

function getDeviceOrientation(): 'portrait' | 'landscape' | 'unknown' {
  if (screen.orientation && screen.orientation.type) {
    return screen.orientation.type.startsWith('portrait') ? 'portrait' : 'landscape'
  }
  if (window.matchMedia('(orientation: portrait)').matches) return 'portrait'
  if (window.matchMedia('(orientation: landscape)').matches) return 'landscape'
  return 'unknown'
}

async function createGestureRecognizer() {
  gestureRecognizerLoaded.value = false
  const vision = await FilesetResolver.forVisionTasks(import.meta.env.BASE_URL + '/wasm')
  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: new URL('../assets/gesture_recognizer.task', import.meta.url).href,
    },
    runningMode: 'VIDEO',
  })
  gestureRecognizerLoaded.value = true
}

onMounted(async () => {
  createGestureRecognizer()
  try {
    // 请求摄像头权限
    window.alert('Treer 即将向您请求摄像头权限\n摄像头数据完全在本地处理, 不会有任何信息被上传')
    checkOrientation()
    window.addEventListener('orientationchange', checkOrientation)
    
    const stream = await window.navigator.mediaDevices.getUserMedia({ video: true })
    if (videoElement.value) {
      videoElement.value.srcObject = stream
      await videoElement.value.play()
      cameras.value = await getCameraDevices()
      selectedCameraId.value = cameras.value[0].deviceId
    }
  } catch (error) {
    if (error instanceof DOMException && 
        error.message.includes('play() can only be initiated by a user gesture')) {
      const stream = await window.navigator.mediaDevices.getUserMedia({ video: true })
      if (videoElement.value) {
        videoElement.value.srcObject = stream
        cameras.value = await getCameraDevices()
        selectedCameraId.value = cameras.value[0].deviceId
      }
    } else {
      console.error('播放视频时发生错误：', error)
    }
  }
  window.requestAnimationFrame(syncObjectLocation)
})

// 修改 detect 函数
async function detect() {
  if (!isDetecting.value) return  // 如果未在检测状态，直接返回
  if (videoElement.value && videoElement.value.paused) {
    try {
      await videoElement.value.play()
    } catch (error) {
      console.error('播放视频时发生错误：', error)
    }
  }
  const start = performance.now()
  if (gestureRecognizerLoaded.value && videoElement.value) {
    if (videoElement.value.readyState < 2) {
      await new Promise<void>((resolve) => {
        videoElement.value!.onloadeddata = () => resolve()
      })
    }
    try {
      handLandmarkerResult = gestureRecognizer!.recognizeForVideo(videoElement.value, Date.now())
    } catch (error) {
      console.error('检测失败：', error)
    }
  }
  const end = performance.now()
  msg.value = handLandmarkerResult
    ? `检测耗时：${(end - start).toFixed(0)}ms, 一共有${handLandmarkerResult.handedness.length}只手`
    : '检测失败，未检测到手'
  // 只在检测状态时继续循环
  if (isDetecting.value) {
    window.requestAnimationFrame(detect)
  }
}

// 添加切换检测状态的函数
function toggleDetection() {
  isDetecting.value = !isDetecting.value
  if (isDetecting.value) {
    detect() // 开始检测循环
  }
}

const gl = {
  shadows: true,
  alpha: true,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: NoToneMapping,
}

// 启动摄像头流
async function startCameraStream(deviceId: string) {
  try {
    // 停止之前的摄像头流
    if (videoElement.value && videoElement.value.srcObject) {
      const stream = videoElement.value.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
    }

    // 请求��的摄像头流
    const stream = await window.navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
    })

    if (videoElement.value) {
      videoElement.value.srcObject = stream
      await videoElement.value.play()
    }
  } catch (error) {
    console.error('无法访问摄像头：', error)
  }
}

watch(selectedCameraId, async (newId) => {
  if (newId) {
    await startCameraStream(newId)
  }
})
</script>
<template>
  <div class="toolbar">
    <button 
      class="toolbarItem" 
      @click="toggleDetection"
      :style="{ backgroundColor: isDetecting ? '#ff4444' : '#f78b3d' }"
    >
      {{ isDetecting ? '暂停' : '开始' }}
    </button>
    <select v-model="selectedCameraId">
      <option v-for="camera in cameras" :key="camera.deviceId" :value="camera.deviceId">
        {{ camera.label }}
      </option>
    </select>
  </div>
  <TresCanvas v-bind="gl" style="pointer-events: none; position: absolute; top: 60px">
    <!-- 摄像头 -->
    <TresPerspectiveCamera :position="[0, 25, 0]" :look-at="[0, 0, 0]" />
    <!-- 控制器 -->
    <!-- <OrbitControls /> -->
    <!-- 模型对象 -->
    <Suspense>
      <ChristmasTree ref="christmasTreeRef" />
    </Suspense>
    <TresDirectionalLight cast-shadow :position="[0, 2, 0]" :intensity="10" />
  </TresCanvas>
  <video class="video_cav" ref="videoElement"></video>
  <div class="msgBox">
    <p class="msgItem1" :style="{ color: gestureRecognizerLoaded ? 'black' : 'red' }">
      {{ gestureRecognizerLoaded ? '模型加载成功' : '模型加载中' }}
    </p>
    <p class="msgItem2">{{ msg }}</p>
    <p class="copyright">
      <a href="https://github.com/Coooolfan/treer">此页面为项目 Treer 的演示。</a>
      &nbsp;定制联系邮箱：coolfan1024@gmail.com
    </p>
  </div>
</template>

<style scoped>
.video_cav {
  width: 100vw;
  height: 100vh;
}
.cam {
  width: 100vw;
  height: 100vh;
}

.toolbar {
  width: 100vw;
  height: 60px;
  display: flex;
  background-color: #f2f2f2;
  justify-content: space-around;
  flex-wrap: wrap;
  align-items: center;
}
.msgItem1 {
  margin-left: 8px;
  position: absolute;
  top: 60px;
  left: 0;
  width: auto;
  height: 60px;
}
.msgItem2 {
  margin-right: 8px;
  position: absolute;
  top: 60px;
  right: 0;
  width: auto;
  height: 60px;
}
.copyright {
  margin: 0;
  position: absolute;
  top: 120px;
  left: 0;
  width: 100%;
  height: 60px;
  background-color: rgba(242, 242, 242, 0.244);
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
select {
  height: 40px;
  width: 200px;
  font-size: large;
  padding: 5px 10px;
  border-radius: 5px;
  background-color: #f78b3d;
  color: #fff;
  border: none;
  cursor: pointer;
}
button {
  width: 5rem;
  height: 40px;
  font-size: large;
  border-radius: 5px;
  background-color: #f78b3d;
  color: #fff;
  border: none;
  cursor: pointer;
}
</style>
