import React from 'react';
import styles from './Content.module.scss';
import AdSense from 'react-adsense';

const Content = ({ body, title }) => (
  <div className={styles['content']}>
    <h1 className={styles['content__title']}>{title}</h1>
    <br />
    <br />
    <AdSense.Google
      client='ca-pub-1302277186878877'
      slot='4581584517'
      style={{ display: 'block' }}
      format='auto'
      responsive='true'
    />
    <div className={styles['content__body']} dangerouslySetInnerHTML={{ __html: body }} />
    <br />
    <AdSense.Google
      client='ca-pub-1302277186878877'
      slot='5125344146'
      style={{ display: 'block' }}
      format='auto'
      responsive='true'
    />
    <br />
  </div>
);

export default Content;
