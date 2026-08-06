import { z } from 'zod';
/** Entity ids: usable as node keys and anchor segment names. */
export declare const idSchema: z.ZodString;
export declare const timeRefSchema: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
/** Values carried by set/tween items: primitives, vectors, point lists. */
declare const propValueSchema: z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodBoolean, z.ZodNull, z.ZodArray<z.ZodNumber>, z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>]>;
export declare const rangeSpecSchema: z.ZodUnion<readonly [z.ZodObject<{
    lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
}, z.core.$strict>, z.ZodObject<{
    word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
}, z.core.$strict>, z.ZodObject<{
    match: z.ZodString;
    which: z.ZodDefault<z.ZodEnum<{
        first: "first";
        last: "last";
        all: "all";
    }>>;
}, z.core.$strict>]>;
declare const textElement: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"text">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        text: z.ZodString;
        fontFamily: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontWeight: z.ZodOptional<z.ZodNumber>;
        textAlign: z.ZodOptional<z.ZodEnum<{
            left: "left";
            center: "center";
            right: "right";
        }>>;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const rectElement: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"rect">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        radius: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>]>>;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const circleElement: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"circle">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        startAngle: z.ZodOptional<z.ZodNumber>;
        endAngle: z.ZodOptional<z.ZodNumber>;
        closed: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const lineElement: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"line">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        radius: z.ZodOptional<z.ZodNumber>;
        startArrow: z.ZodOptional<z.ZodBoolean>;
        endArrow: z.ZodOptional<z.ZodBoolean>;
        arrowSize: z.ZodOptional<z.ZodNumber>;
        /** Percent-draw clip, 0..1 — animate for draw-on effects. */
        start: z.ZodOptional<z.ZodNumber>;
        end: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const pathElement: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"path">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        data: z.ZodString;
        start: z.ZodOptional<z.ZodNumber>;
        end: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const polygonElement: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"polygon">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        sides: z.ZodOptional<z.ZodNumber>;
        radius: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const imageElement: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"image">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        /** Asset id or a path relative to the document. */
        src: z.ZodString;
        alpha: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const svgElement: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"svg">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        /** Inline SVG markup… */
        svg: z.ZodOptional<z.ZodString>;
        /** …or an asset id of type "svg". Exactly one of the two. */
        src: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const latexElement: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"latex">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        tex: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const codeElement: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"code">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        code: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        /** Fallback token color (used when no highlighter is configured). */
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        selection: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodObject<{
            lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
        }, z.core.$strict>, z.ZodObject<{
            word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
        }, z.core.$strict>, z.ZodObject<{
            match: z.ZodString;
            which: z.ZodDefault<z.ZodEnum<{
                first: "first";
                last: "last";
                all: "all";
            }>>;
        }, z.core.$strict>]>, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
        }, z.core.$strict>, z.ZodObject<{
            word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
        }, z.core.$strict>, z.ZodObject<{
            match: z.ZodString;
            which: z.ZodDefault<z.ZodEnum<{
                first: "first";
                last: "last";
                all: "all";
            }>>;
        }, z.core.$strict>]>>]>>;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const layoutPropsSchema: z.ZodObject<{
    x: z.ZodOptional<z.ZodNumber>;
    y: z.ZodOptional<z.ZodNumber>;
    scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
    rotation: z.ZodOptional<z.ZodNumber>;
    opacity: z.ZodOptional<z.ZodNumber>;
    zIndex: z.ZodOptional<z.ZodNumber>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    direction: z.ZodOptional<z.ZodEnum<{
        row: "row";
        "row-reverse": "row-reverse";
        column: "column";
        "column-reverse": "column-reverse";
    }>>;
    gap: z.ZodOptional<z.ZodNumber>;
    padding: z.ZodOptional<z.ZodNumber>;
    alignItems: z.ZodOptional<z.ZodEnum<{
        start: "start";
        end: "end";
        center: "center";
        stretch: "stretch";
        baseline: "baseline";
    }>>;
    justifyContent: z.ZodOptional<z.ZodEnum<{
        start: "start";
        end: "end";
        center: "center";
        "space-between": "space-between";
        "space-around": "space-around";
        "space-evenly": "space-evenly";
    }>>;
}, z.core.$strict>;
/** The one hand-written type: layout recursion breaks zod's inference. */
export interface LayoutElement {
    id: string;
    type: 'layout';
    props: z.infer<typeof layoutPropsSchema>;
    children: DocumentElement[];
}
export type DocumentElement = z.infer<typeof textElement> | z.infer<typeof rectElement> | z.infer<typeof circleElement> | z.infer<typeof lineElement> | z.infer<typeof pathElement> | z.infer<typeof polygonElement> | z.infer<typeof imageElement> | z.infer<typeof svgElement> | z.infer<typeof latexElement> | z.infer<typeof codeElement> | LayoutElement;
export declare const elementSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"text">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        text: z.ZodString;
        fontFamily: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontWeight: z.ZodOptional<z.ZodNumber>;
        textAlign: z.ZodOptional<z.ZodEnum<{
            left: "left";
            center: "center";
            right: "right";
        }>>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"rect">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        radius: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>]>>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"circle">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        startAngle: z.ZodOptional<z.ZodNumber>;
        endAngle: z.ZodOptional<z.ZodNumber>;
        closed: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"line">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
        radius: z.ZodOptional<z.ZodNumber>;
        startArrow: z.ZodOptional<z.ZodBoolean>;
        endArrow: z.ZodOptional<z.ZodBoolean>;
        arrowSize: z.ZodOptional<z.ZodNumber>;
        /** Percent-draw clip, 0..1 — animate for draw-on effects. */
        start: z.ZodOptional<z.ZodNumber>;
        end: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"path">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        data: z.ZodString;
        start: z.ZodOptional<z.ZodNumber>;
        end: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"polygon">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        lineWidth: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        sides: z.ZodOptional<z.ZodNumber>;
        radius: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"image">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        /** Asset id or a path relative to the document. */
        src: z.ZodString;
        alpha: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"svg">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        /** Inline SVG markup… */
        svg: z.ZodOptional<z.ZodString>;
        /** …or an asset id of type "svg". Exactly one of the two. */
        src: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"latex">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        tex: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"code">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        code: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        /** Fallback token color (used when no highlighter is configured). */
        fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        selection: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodObject<{
            lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
        }, z.core.$strict>, z.ZodObject<{
            word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
        }, z.core.$strict>, z.ZodObject<{
            match: z.ZodString;
            which: z.ZodDefault<z.ZodEnum<{
                first: "first";
                last: "last";
                all: "all";
            }>>;
        }, z.core.$strict>]>, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
        }, z.core.$strict>, z.ZodObject<{
            word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
        }, z.core.$strict>, z.ZodObject<{
            match: z.ZodString;
            which: z.ZodDefault<z.ZodEnum<{
                first: "first";
                last: "last";
                all: "all";
            }>>;
        }, z.core.$strict>]>>]>>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"layout">;
    props: z.ZodObject<{
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
        rotation: z.ZodOptional<z.ZodNumber>;
        opacity: z.ZodOptional<z.ZodNumber>;
        zIndex: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        direction: z.ZodOptional<z.ZodEnum<{
            row: "row";
            "row-reverse": "row-reverse";
            column: "column";
            "column-reverse": "column-reverse";
        }>>;
        gap: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
        alignItems: z.ZodOptional<z.ZodEnum<{
            start: "start";
            end: "end";
            center: "center";
            stretch: "stretch";
            baseline: "baseline";
        }>>;
        justifyContent: z.ZodOptional<z.ZodEnum<{
            start: "start";
            end: "end";
            center: "center";
            "space-between": "space-between";
            "space-around": "space-around";
            "space-evenly": "space-evenly";
        }>>;
    }, z.core.$strict>;
    readonly children: z.ZodType<DocumentElement[]>;
}, z.core.$strict>], "type">;
export declare const timelineItemSchema: z.ZodUnion<readonly [z.ZodObject<{
    at: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    target: z.ZodString;
    set: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodBoolean, z.ZodNull, z.ZodArray<z.ZodNumber>, z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>]>>;
}, z.core.$strict>, z.ZodObject<{
    at: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    target: z.ZodString;
    tween: z.ZodRecord<z.ZodString, z.ZodObject<{
        to: z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodBoolean, z.ZodNull, z.ZodArray<z.ZodNumber>, z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>]>;
        from: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodBoolean, z.ZodNull, z.ZodArray<z.ZodNumber>, z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>]>>;
    }, z.core.$strict>>;
    dur: z.ZodNumber;
    easing: z.ZodOptional<z.ZodEnum<{
        linear: "linear";
        easeInSine: "easeInSine";
        easeOutSine: "easeOutSine";
        easeInOutSine: "easeInOutSine";
        easeInQuad: "easeInQuad";
        easeOutQuad: "easeOutQuad";
        easeInOutQuad: "easeInOutQuad";
        easeInCubic: "easeInCubic";
        easeOutCubic: "easeOutCubic";
        easeInOutCubic: "easeInOutCubic";
        easeInQuart: "easeInQuart";
        easeOutQuart: "easeOutQuart";
        easeInOutQuart: "easeInOutQuart";
        easeInQuint: "easeInQuint";
        easeOutQuint: "easeOutQuint";
        easeInOutQuint: "easeInOutQuint";
        easeInExpo: "easeInExpo";
        easeOutExpo: "easeOutExpo";
        easeInOutExpo: "easeInOutExpo";
        easeInCirc: "easeInCirc";
        easeOutCirc: "easeOutCirc";
        easeInOutCirc: "easeInOutCirc";
        easeInBack: "easeInBack";
        easeOutBack: "easeOutBack";
        easeInOutBack: "easeInOutBack";
        easeInBounce: "easeInBounce";
        easeOutBounce: "easeOutBounce";
        easeInOutBounce: "easeInOutBounce";
        easeInElastic: "easeInElastic";
        easeOutElastic: "easeOutElastic";
        easeInOutElastic: "easeInOutElastic";
    }>>;
}, z.core.$strict>, z.ZodObject<{
    at: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    target: z.ZodString;
    select: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodObject<{
        lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
    }, z.core.$strict>, z.ZodObject<{
        word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
    }, z.core.$strict>, z.ZodObject<{
        match: z.ZodString;
        which: z.ZodDefault<z.ZodEnum<{
            first: "first";
            last: "last";
            all: "all";
        }>>;
    }, z.core.$strict>]>, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
    }, z.core.$strict>, z.ZodObject<{
        word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
    }, z.core.$strict>, z.ZodObject<{
        match: z.ZodString;
        which: z.ZodDefault<z.ZodEnum<{
            first: "first";
            last: "last";
            all: "all";
        }>>;
    }, z.core.$strict>]>>]>;
    dur: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>, z.ZodObject<{
    at: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    target: z.ZodString;
    edit: z.ZodObject<{
        /** Whole-code replacement, diffed token-wise when animated. */
        to: z.ZodOptional<z.ZodString>;
        replace: z.ZodOptional<z.ZodTuple<[z.ZodUnion<readonly [z.ZodObject<{
            lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
        }, z.core.$strict>, z.ZodObject<{
            word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
        }, z.core.$strict>, z.ZodObject<{
            match: z.ZodString;
            which: z.ZodDefault<z.ZodEnum<{
                first: "first";
                last: "last";
                all: "all";
            }>>;
        }, z.core.$strict>]>, z.ZodString], null>>;
        insert: z.ZodOptional<z.ZodTuple<[z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodString], null>>;
        remove: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
        }, z.core.$strict>, z.ZodObject<{
            word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
        }, z.core.$strict>, z.ZodObject<{
            match: z.ZodString;
            which: z.ZodDefault<z.ZodEnum<{
                first: "first";
                last: "last";
                all: "all";
            }>>;
        }, z.core.$strict>]>>;
    }, z.core.$strict>;
    dur: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>, z.ZodObject<{
    at: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
    block: z.ZodObject<{
        src: z.ZodString;
        dur: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>]>;
export declare const documentSchema: z.ZodObject<{
    version: z.ZodLiteral<"0.1">;
    meta: z.ZodObject<{
        fps: z.ZodNumber;
        size: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        background: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        duration: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
    assets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<{
            image: "image";
            svg: "svg";
            audio: "audio";
        }>;
        src: z.ZodString;
    }, z.core.$strict>>>;
    narration: z.ZodOptional<z.ZodObject<{
        audio: z.ZodOptional<z.ZodString>;
        segments: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            text: z.ZodString;
            start: z.ZodNumber;
            dur: z.ZodNumber;
            words: z.ZodOptional<z.ZodArray<z.ZodObject<{
                text: z.ZodString;
                start: z.ZodNumber;
                dur: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>>>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    elements: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"text">;
        props: z.ZodObject<{
            x: z.ZodOptional<z.ZodNumber>;
            y: z.ZodOptional<z.ZodNumber>;
            scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
            zIndex: z.ZodOptional<z.ZodNumber>;
            fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineWidth: z.ZodOptional<z.ZodNumber>;
            text: z.ZodString;
            fontFamily: z.ZodOptional<z.ZodString>;
            fontSize: z.ZodOptional<z.ZodNumber>;
            fontWeight: z.ZodOptional<z.ZodNumber>;
            textAlign: z.ZodOptional<z.ZodEnum<{
                left: "left";
                center: "center";
                right: "right";
            }>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"rect">;
        props: z.ZodObject<{
            x: z.ZodOptional<z.ZodNumber>;
            y: z.ZodOptional<z.ZodNumber>;
            scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
            zIndex: z.ZodOptional<z.ZodNumber>;
            fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineWidth: z.ZodOptional<z.ZodNumber>;
            width: z.ZodOptional<z.ZodNumber>;
            height: z.ZodOptional<z.ZodNumber>;
            radius: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>]>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"circle">;
        props: z.ZodObject<{
            x: z.ZodOptional<z.ZodNumber>;
            y: z.ZodOptional<z.ZodNumber>;
            scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
            zIndex: z.ZodOptional<z.ZodNumber>;
            fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineWidth: z.ZodOptional<z.ZodNumber>;
            width: z.ZodOptional<z.ZodNumber>;
            height: z.ZodOptional<z.ZodNumber>;
            startAngle: z.ZodOptional<z.ZodNumber>;
            endAngle: z.ZodOptional<z.ZodNumber>;
            closed: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"line">;
        props: z.ZodObject<{
            x: z.ZodOptional<z.ZodNumber>;
            y: z.ZodOptional<z.ZodNumber>;
            scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
            zIndex: z.ZodOptional<z.ZodNumber>;
            fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineWidth: z.ZodOptional<z.ZodNumber>;
            points: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
            radius: z.ZodOptional<z.ZodNumber>;
            startArrow: z.ZodOptional<z.ZodBoolean>;
            endArrow: z.ZodOptional<z.ZodBoolean>;
            arrowSize: z.ZodOptional<z.ZodNumber>;
            /** Percent-draw clip, 0..1 — animate for draw-on effects. */
            start: z.ZodOptional<z.ZodNumber>;
            end: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"path">;
        props: z.ZodObject<{
            x: z.ZodOptional<z.ZodNumber>;
            y: z.ZodOptional<z.ZodNumber>;
            scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
            zIndex: z.ZodOptional<z.ZodNumber>;
            fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineWidth: z.ZodOptional<z.ZodNumber>;
            data: z.ZodString;
            start: z.ZodOptional<z.ZodNumber>;
            end: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"polygon">;
        props: z.ZodObject<{
            x: z.ZodOptional<z.ZodNumber>;
            y: z.ZodOptional<z.ZodNumber>;
            scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
            zIndex: z.ZodOptional<z.ZodNumber>;
            fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            stroke: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            lineWidth: z.ZodOptional<z.ZodNumber>;
            width: z.ZodOptional<z.ZodNumber>;
            height: z.ZodOptional<z.ZodNumber>;
            sides: z.ZodOptional<z.ZodNumber>;
            radius: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"image">;
        props: z.ZodObject<{
            x: z.ZodOptional<z.ZodNumber>;
            y: z.ZodOptional<z.ZodNumber>;
            scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
            zIndex: z.ZodOptional<z.ZodNumber>;
            width: z.ZodOptional<z.ZodNumber>;
            height: z.ZodOptional<z.ZodNumber>;
            /** Asset id or a path relative to the document. */
            src: z.ZodString;
            alpha: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"svg">;
        props: z.ZodObject<{
            x: z.ZodOptional<z.ZodNumber>;
            y: z.ZodOptional<z.ZodNumber>;
            scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
            zIndex: z.ZodOptional<z.ZodNumber>;
            width: z.ZodOptional<z.ZodNumber>;
            height: z.ZodOptional<z.ZodNumber>;
            /** Inline SVG markup… */
            svg: z.ZodOptional<z.ZodString>;
            /** …or an asset id of type "svg". Exactly one of the two. */
            src: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"latex">;
        props: z.ZodObject<{
            x: z.ZodOptional<z.ZodNumber>;
            y: z.ZodOptional<z.ZodNumber>;
            scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
            zIndex: z.ZodOptional<z.ZodNumber>;
            width: z.ZodOptional<z.ZodNumber>;
            height: z.ZodOptional<z.ZodNumber>;
            tex: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"code">;
        props: z.ZodObject<{
            x: z.ZodOptional<z.ZodNumber>;
            y: z.ZodOptional<z.ZodNumber>;
            scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
            zIndex: z.ZodOptional<z.ZodNumber>;
            code: z.ZodString;
            fontSize: z.ZodOptional<z.ZodNumber>;
            fontFamily: z.ZodOptional<z.ZodString>;
            /** Fallback token color (used when no highlighter is configured). */
            fill: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            selection: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodObject<{
                lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
            }, z.core.$strict>, z.ZodObject<{
                word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
            }, z.core.$strict>, z.ZodObject<{
                match: z.ZodString;
                which: z.ZodDefault<z.ZodEnum<{
                    first: "first";
                    last: "last";
                    all: "all";
                }>>;
            }, z.core.$strict>]>, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
                lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
            }, z.core.$strict>, z.ZodObject<{
                word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
            }, z.core.$strict>, z.ZodObject<{
                match: z.ZodString;
                which: z.ZodDefault<z.ZodEnum<{
                    first: "first";
                    last: "last";
                    all: "all";
                }>>;
            }, z.core.$strict>]>>]>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"layout">;
        props: z.ZodObject<{
            x: z.ZodOptional<z.ZodNumber>;
            y: z.ZodOptional<z.ZodNumber>;
            scale: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]>>;
            rotation: z.ZodOptional<z.ZodNumber>;
            opacity: z.ZodOptional<z.ZodNumber>;
            zIndex: z.ZodOptional<z.ZodNumber>;
            width: z.ZodOptional<z.ZodNumber>;
            height: z.ZodOptional<z.ZodNumber>;
            direction: z.ZodOptional<z.ZodEnum<{
                row: "row";
                "row-reverse": "row-reverse";
                column: "column";
                "column-reverse": "column-reverse";
            }>>;
            gap: z.ZodOptional<z.ZodNumber>;
            padding: z.ZodOptional<z.ZodNumber>;
            alignItems: z.ZodOptional<z.ZodEnum<{
                start: "start";
                end: "end";
                center: "center";
                stretch: "stretch";
                baseline: "baseline";
            }>>;
            justifyContent: z.ZodOptional<z.ZodEnum<{
                start: "start";
                end: "end";
                center: "center";
                "space-between": "space-between";
                "space-around": "space-around";
                "space-evenly": "space-evenly";
            }>>;
        }, z.core.$strict>;
        readonly children: z.ZodType<DocumentElement[]>;
    }, z.core.$strict>], "type">>;
    timeline: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        at: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
        target: z.ZodString;
        set: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodBoolean, z.ZodNull, z.ZodArray<z.ZodNumber>, z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>]>>;
    }, z.core.$strict>, z.ZodObject<{
        at: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
        target: z.ZodString;
        tween: z.ZodRecord<z.ZodString, z.ZodObject<{
            to: z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodBoolean, z.ZodNull, z.ZodArray<z.ZodNumber>, z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>]>;
            from: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodBoolean, z.ZodNull, z.ZodArray<z.ZodNumber>, z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>]>>;
        }, z.core.$strict>>;
        dur: z.ZodNumber;
        easing: z.ZodOptional<z.ZodEnum<{
            linear: "linear";
            easeInSine: "easeInSine";
            easeOutSine: "easeOutSine";
            easeInOutSine: "easeInOutSine";
            easeInQuad: "easeInQuad";
            easeOutQuad: "easeOutQuad";
            easeInOutQuad: "easeInOutQuad";
            easeInCubic: "easeInCubic";
            easeOutCubic: "easeOutCubic";
            easeInOutCubic: "easeInOutCubic";
            easeInQuart: "easeInQuart";
            easeOutQuart: "easeOutQuart";
            easeInOutQuart: "easeInOutQuart";
            easeInQuint: "easeInQuint";
            easeOutQuint: "easeOutQuint";
            easeInOutQuint: "easeInOutQuint";
            easeInExpo: "easeInExpo";
            easeOutExpo: "easeOutExpo";
            easeInOutExpo: "easeInOutExpo";
            easeInCirc: "easeInCirc";
            easeOutCirc: "easeOutCirc";
            easeInOutCirc: "easeInOutCirc";
            easeInBack: "easeInBack";
            easeOutBack: "easeOutBack";
            easeInOutBack: "easeInOutBack";
            easeInBounce: "easeInBounce";
            easeOutBounce: "easeOutBounce";
            easeInOutBounce: "easeInOutBounce";
            easeInElastic: "easeInElastic";
            easeOutElastic: "easeOutElastic";
            easeInOutElastic: "easeInOutElastic";
        }>>;
    }, z.core.$strict>, z.ZodObject<{
        at: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
        target: z.ZodString;
        select: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodObject<{
            lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
        }, z.core.$strict>, z.ZodObject<{
            word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
        }, z.core.$strict>, z.ZodObject<{
            match: z.ZodString;
            which: z.ZodDefault<z.ZodEnum<{
                first: "first";
                last: "last";
                all: "all";
            }>>;
        }, z.core.$strict>]>, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
        }, z.core.$strict>, z.ZodObject<{
            word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
        }, z.core.$strict>, z.ZodObject<{
            match: z.ZodString;
            which: z.ZodDefault<z.ZodEnum<{
                first: "first";
                last: "last";
                all: "all";
            }>>;
        }, z.core.$strict>]>>]>;
        dur: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        at: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
        target: z.ZodString;
        edit: z.ZodObject<{
            /** Whole-code replacement, diffed token-wise when animated. */
            to: z.ZodOptional<z.ZodString>;
            replace: z.ZodOptional<z.ZodTuple<[z.ZodUnion<readonly [z.ZodObject<{
                lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
            }, z.core.$strict>, z.ZodObject<{
                word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
            }, z.core.$strict>, z.ZodObject<{
                match: z.ZodString;
                which: z.ZodDefault<z.ZodEnum<{
                    first: "first";
                    last: "last";
                    all: "all";
                }>>;
            }, z.core.$strict>]>, z.ZodString], null>>;
            insert: z.ZodOptional<z.ZodTuple<[z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodString], null>>;
            remove: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
                lines: z.ZodTuple<[z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>;
            }, z.core.$strict>, z.ZodObject<{
                word: z.ZodUnion<readonly [z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>, z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodUnion<readonly [z.ZodNumber, z.ZodNull]>], null>]>;
            }, z.core.$strict>, z.ZodObject<{
                match: z.ZodString;
                which: z.ZodDefault<z.ZodEnum<{
                    first: "first";
                    last: "last";
                    all: "all";
                }>>;
            }, z.core.$strict>]>>;
        }, z.core.$strict>;
        dur: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        at: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
        block: z.ZodObject<{
            src: z.ZodString;
            dur: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>]>>;
}, z.core.$strict>;
export type FantocheDocument = z.infer<typeof documentSchema>;
export type TimelineItem = z.infer<typeof timelineItemSchema>;
export type RangeSpec = z.infer<typeof rangeSpecSchema>;
export type PropValue = z.infer<typeof propValueSchema>;
export {};
//# sourceMappingURL=schema.d.ts.map