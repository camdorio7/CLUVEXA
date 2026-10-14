import styles from "./PortalFrame.module.css";
export default function PortalLoading() {
  return (
    <div className={styles.loading} role="status" aria-label="Loading page">
      <div className={styles.skeletonTitle} />
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonCards}>
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}
