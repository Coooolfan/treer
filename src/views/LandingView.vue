<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { BasicShadowMap, SRGBColorSpace, NoToneMapping } from 'three'

import ChristmasTree from '../components/ChristmasTree.vue'
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { getDistance } from '@/Utils'

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

async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await window.navigator.mediaDevices.enumerateDevices()
  return devices.filter((device) => device.kind === 'videoinput')
}

function syncObjectLocation() {
  if (videoElement.value) {
    const videoWidth = videoElement.value.videoWidth
    const videoHeight = videoElement.value.videoHeight

    let center_x = 0
    let center_y = 0
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

      // debugMsg.value = `${getDistance(landmark0, landmark5)} \n ${getDistance(landmark17, landmark5)}\n${getDistance(landmark0, landmark17)}mm`

      // 调整模型位置和缩放比例，默认为竖屏
      let positionScale = 60
      let senceScale = 0.5
      if (orientation.value === 'landscape') {
        positionScale = 20
        senceScale = 0.2
      }

      // 调整模型位置
      if (christmasTreeRef.value?.boxRef) {
        const boxRef = christmasTreeRef.value.boxRef
        if (boxRef) {
          boxRef.position.x = (center_x - videoWidth / 2) / positionScale
          boxRef.position.z = (center_y - videoHeight / 2) / positionScale
        }
      }

      // 调整模型缩放
      const avgDistance =
        (getDistance(landmark0, landmark5) +
          getDistance(landmark17, landmark5) +
          getDistance(landmark0, landmark17)) /
        3
      if (christmasTreeRef.value?.setScale) {
        christmasTreeRef.value.setScale(
          avgDistance / senceScale,
          avgDistance / senceScale,
          avgDistance / senceScale,
        )
      }
    }
  }
  window.requestAnimationFrame(syncObjectLocation)
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
    // 提示用户允许摄像头权限
    // window.alert('Treer 即将向您请求摄像头权限\n摄像头数据完全在本地处理, 不会有任何信息被上传')
    // 检查横竖屏
    checkOrientation()
    window.addEventListener('orientationchange', checkOrientation)
    // 尝试初始化摄像头
    const stream = await window.navigator.mediaDevices.getUserMedia({ video: true })
    if (videoElement.value) {
      videoElement.value.srcObject = stream
      await videoElement.value.play()
      cameras.value = await getCameraDevices()
      selectedCameraId.value = cameras.value[0].deviceId
    }
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.message.includes('play() can only be initiated by a user gesture')
    ) {
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

const gl = {
  shadows: true,
  alpha: true,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: NoToneMapping,
}

async function detect() {
  if (videoElement.value && videoElement.value.paused) {
    try {
      await videoElement.value.play()
    } catch (error) {
      console.error('播放视频时发生错误：', error)
    }
  }
  // 开始时间
  const start = performance.now()
  if (gestureRecognizerLoaded.value && videoElement.value) {
    // 等待视频元数据加载完成
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

  // 结束时间
  const end = performance.now()
  // console.log(handLandmarkerResult, end - start + 'ms')
  msg.value = handLandmarkerResult
    ? `检测耗时：${(end - start).toFixed(0)}ms, 一共有${handLandmarkerResult.handedness.length}只手`
    : '检测失败，未检测到手'
  window.requestAnimationFrame(detect)
}

function checkOrientation() {
  orientation.value = getDeviceOrientation()
}

function getDeviceOrientation(): 'portrait' | 'landscape' | 'unknown' {
  // 若支持 Screen Orientation API
  if (screen.orientation && screen.orientation.type) {
    return screen.orientation.type.startsWith('portrait') ? 'portrait' : 'landscape'
  }
  // 若不支持，则使用 matchMedia
  if (window.matchMedia('(orientation: portrait)').matches) {
    return 'portrait'
  }
  if (window.matchMedia('(orientation: landscape)').matches) {
    return 'landscape'
  }
  // 其他情况返回 unknown
  return 'unknown'
}

// 启动摄像头流
async function startCameraStream(deviceId: string) {
  try {
    // 停止之前的摄像头流
    if (videoElement.value && videoElement.value.srcObject) {
      const stream = videoElement.value.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
    }

    // 请求新的摄像头流
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
    <button class="toolbarItem" @click="detect">开始</button>
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
      此页面为项目 Treer 的演示站。项目地址：
      <a href="https://github.com/Coooolfan/treer">https://github.com/Coooolfan/treer</a>
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
  top: 60px;
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
