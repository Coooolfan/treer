<script setup lang="ts">
import { useRenderLoop, type TresInstance } from '@tresjs/core'
import { useGLTF } from '@tresjs/cientos'
import { shallowRef, type ShallowRef } from 'vue'
const boxRef: ShallowRef<TresInstance | null> = shallowRef(null)

const setScale = (x: number, y: number, z: number) => {
  if (scene) {
    scene.scale.set(x, y, z)
  }
}
// 暴露 boxRef
defineExpose({ boxRef, setScale })

// scene.scale.set(30, 30, 30)

const { scene } = await useGLTF(new URL('../assets/christmas_tree.gltf', import.meta.url).href)
scene.position.y = 0
scene.scale.set(0, 0, 0)
const { onLoop } = useRenderLoop()
onLoop(({ delta }) => {
  if (boxRef.value) {
    boxRef.value.rotation.y += delta / 1.1
    boxRef.value.rotation.x = -Math.PI / 2
    // boxRef.value.rotation.z = elapsed * 0.2
    // boxRef.value.position.y += delta
  }
})
</script>

<template>
  <primitive ref="boxRef" :object="scene" />
</template>
