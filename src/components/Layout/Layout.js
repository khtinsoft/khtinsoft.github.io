import React from 'react';
import Helmet from 'react-helmet';
import styles from './Layout.module.scss';

const Layout = ({ children, title, description }) => (
  <div className={styles.layout}>
    <Helmet>
      <html lang="en" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="naver-site-verification" content="afc2fad93034344208fd7c386af1f9cde4eb15d5" />
    </Helmet>
    {children}
  </div>
);

export default Layout;
