import {Circle, Layout, Line, Rect, makeScene2D} from '@fantoche-dev/2d';
import {all, createRef, createSignal} from '@fantoche-dev/core';

export default makeScene2D('mc-compat', function* (view) {
  const progress = createSignal(0);
  const circle = createRef<Circle>();

  view.add(
    <Layout layout gap={10} padding={20} direction={'column'} width={300}>
      <Layout gap={10}>
        <Rect size={60} fill={'#e13238'} radius={8} />
        <Rect size={60} fill={'#e6a700'} radius={8} />
        <Rect
          size={60}
          radius={8}
          fill={() => `rgba(50,100,200,${0.5 + progress() * 0.5})`}
        />
      </Layout>
      <Circle
        ref={circle}
        size={80}
        fill={'lightseagreen'}
        end={() => 0.25 + progress() * 0.75}
        lineWidth={8}
        stroke={'#2a2a35'}
      />
      <Line
        points={[
          [-100, 40],
          [0, -40],
          [100, 40],
        ]}
        stroke={'#5c6470'}
        lineWidth={6}
        radius={20}
        endArrow
      />
    </Layout>,
  );

  yield* all(progress(1, 1), circle().scale(1.2, 1));
});
