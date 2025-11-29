declare module "*.worker.ts" {
    const ctor: () => Worker;
    export default ctor;
}
