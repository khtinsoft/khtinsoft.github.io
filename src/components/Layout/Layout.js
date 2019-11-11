import React from 'react';
import Helmet from 'react-helmet';
import styles from './Layout.module.scss';

const Layout = ({ children, title, description, tags }) => (
  <div className={styles.layout}>
    <Helmet>
      <html lang="en" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta name="keywords" content={`${tags ? tags.join(",") : ""}`} />
      <meta property="og:description" content={description} />
      <script data-ad-client="ca-pub-1302277186878877" async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
      <meta name="naver-site-verification" content="afc2fad93034344208fd7c386af1f9cde4eb15d5" />
    </Helmet>
    {children}
  </div>
);

export default Layout;
