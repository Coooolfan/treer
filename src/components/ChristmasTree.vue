<script setup lang="ts">
import { useLoader, useRenderLoop, type TresInstance } from '@tresjs/core'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader'
import { shallowRef, type ShallowRef } from 'vue'
const boxRef: ShallowRef<TresInstance | null> = shallowRef(null)

const setScale = (x: number, y: number, z: number) => {
  if (scene) {
    scene.scale.set(x, y, z)
  }
}
// 暴露 boxRef
defineExpose({ boxRef, setScale })

// const { scene } = await useLoader(GLTFLoader, 'src/assets/earphone.gltf')
// scene.scale.set(30, 30, 30)

const { scene } = await useLoader(GLTFLoader, 'src/assets/christmas_tree.gltf')
scene.position.y = 0
const { onLoop } = useRenderLoop()
onLoop(({ delta }) => {
  if (boxRef.value) {
    boxRef.value.rotation.y += delta / 1.1
    boxRef.value.rotation.x = -Math.PI / 1.8
    // boxRef.value.rotation.z = elapsed * 0.2
    // boxRef.value.position.y += delta
  }
})
</script>

<template>
  <primitive ref="boxRef" :object="scene" />
</template>
