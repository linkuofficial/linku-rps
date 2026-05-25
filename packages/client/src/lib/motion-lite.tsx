import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ImgHTMLAttributes, type PropsWithChildren } from 'react';

type MotionProps = {
    initial?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
    whileTap?: unknown;
    whileHover?: unknown;
    layout?: unknown;
    variants?: unknown;
};

type PresenceProps = PropsWithChildren<{
    mode?: 'wait' | 'sync' | 'popLayout';
}>;

const MotionDiv = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & MotionProps>(function MotionDiv(
    props,
    ref
) {
    const { initial, animate, exit, transition, whileTap, whileHover, layout, variants, ...rest } = props;
    void initial;
    void animate;
    void exit;
    void transition;
    void whileTap;
    void whileHover;
    void layout;
    void variants;
    return <div ref={ref} {...rest} />;
});

const MotionButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & MotionProps>(
    function MotionButton(props, ref) {
        const { initial, animate, exit, transition, whileTap, whileHover, layout, variants, ...rest } = props;
        void initial;
        void animate;
        void exit;
        void transition;
        void whileTap;
        void whileHover;
        void layout;
        void variants;
        return <button ref={ref} {...rest} />;
    }
);

const MotionImg = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement> & MotionProps>(function MotionImg(
    props,
    ref
) {
    const { initial, animate, exit, transition, whileTap, whileHover, layout, variants, ...rest } = props;
    void initial;
    void animate;
    void exit;
    void transition;
    void whileTap;
    void whileHover;
    void layout;
    void variants;
    return <img ref={ref} {...rest} />;
});

export const motion = {
    div: MotionDiv,
    button: MotionButton,
    img: MotionImg,
};

export function AnimatePresence({ children }: PresenceProps) {
    return <>{children}</>;
}
