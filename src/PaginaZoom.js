// src/PaginaZoom.js — uma página de mangá com pinch-to-zoom.
//
// Envolve a imagem num gesto de pinça (dois dedos) que escala a página,
// combinado com um arrastar (um dedo) que só age quando há zoom — assim,
// em escala 1, o arrastar vertical é entregue à FlatList do leitor e a
// rolagem entre páginas continua normal. Duplo-toque alterna 1x/2x.

import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const ESCALA_MAX = 4;
const ESCALA_DUPLO_TOQUE = 2;

export default function PaginaZoom({ uri, largura, altura }) {
  const escala = useSharedValue(1);
  const escalaSalva = useSharedValue(1);
  const transX = useSharedValue(0);
  const transY = useSharedValue(0);
  const inicioX = useSharedValue(0);
  const inicioY = useSharedValue(0);

  // Mantém a imagem dentro de limites razoáveis ao soltar os dedos.
  function normalizar() {
    "worklet";
    if (escala.value < 1) {
      escala.value = withTiming(1);
      escalaSalva.value = 1;
      transX.value = withTiming(0);
      transY.value = withTiming(0);
      inicioX.value = 0;
      inicioY.value = 0;
    } else if (escala.value > ESCALA_MAX) {
      escala.value = withTiming(ESCALA_MAX);
      escalaSalva.value = ESCALA_MAX;
    } else {
      escalaSalva.value = escala.value;
    }
  }

  const pinca = Gesture.Pinch()
    .onUpdate((e) => {
      escala.value = escalaSalva.value * e.scale;
    })
    .onEnd(() => {
      normalizar();
    });

  // Arrastar a imagem quando há zoom. Em escala 1 o onUpdate não translada
  // nada, então o toque não "vira" um arrasto e a rolagem vertical da
  // FlatList continua funcionando normalmente entre as páginas.
  const arrasto = Gesture.Pan()
    .onStart(() => {
      inicioX.value = transX.value;
      inicioY.value = transY.value;
    })
    .onUpdate((e) => {
      if (escala.value <= 1) return;
      transX.value = inicioX.value + e.translationX;
      transY.value = inicioY.value + e.translationY;
    })
    .onEnd(() => {
      // Sem zoom, garante a imagem centralizada.
      if (escala.value <= 1) {
        transX.value = withTiming(0);
        transY.value = withTiming(0);
      }
    });

  const duploToque = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (escala.value > 1) {
        escala.value = withTiming(1);
        escalaSalva.value = 1;
        transX.value = withTiming(0);
        transY.value = withTiming(0);
      } else {
        escala.value = withTiming(ESCALA_DUPLO_TOQUE);
        escalaSalva.value = ESCALA_DUPLO_TOQUE;
      }
    });

  // A pinça e o arrasto agem juntos; o duplo-toque compete com eles.
  const gesto = Gesture.Race(
    duploToque,
    Gesture.Simultaneous(pinca, arrasto)
  );

  const estilo = useAnimatedStyle(() => ({
    transform: [
      { translateX: transX.value },
      { translateY: transY.value },
      { scale: escala.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesto}>
      <Animated.Image
        source={{ uri }}
        style={[{ width: largura, height: altura }, estilo]}
        resizeMode="contain"
      />
    </GestureDetector>
  );
}
