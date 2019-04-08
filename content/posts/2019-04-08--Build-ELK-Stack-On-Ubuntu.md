---
title: Ubuntu 18.04 ELK Stack 구축
date: "2019-04-08"
template: "post"
draft: false
slug: "/posts/build-elk-on-ubuntu/"
category: "Infra/Platform"
tags:
  - "ELK"
  - "ElasticSearch"
  - "Logstash"
  - "Kibana"
  - "Ubuntu"
description: "Ubuntu 18.04 서버에 ELK (ElasticSearch-LogStash-Kibana) 스택을 구성한다. S3에 적재되고 있는 Load Balance의 로그 파일을 확인한다."
---

<!-- - [The first transition](#the-first-transition)
- [The digital age](#the-digital-age)
- [Loss of humanity through transitions](#loss-of-humanity-through-transitions)
- [Chasing perfection](#chasing-perfection) -->


## Introduction

현재 운영중인 서비스의 다양한 로그들을 모으고, 활용하기 위한 첫번째 단계로 ELK (ElasticSearch-Logstash-Kibana) 스택을 구축하게 되었다.
Ubuntu 18.04 EC2 Instance에 ELK Stack을 구축하는 방식으로 기록한다.

우선 목표는, 구축된 ELK 스택을 통해, Amazon S3에 적재되고 있는 Load Balance의 Access Log를 Kibana에서 확인하는 것이다.


## Prerequisites

ELK 스택 구축에 앞서, Ubuntu 18.04 EC2 인스턴스를 생성하고, 해당 인스턴스에 Oracle Java 8 버전을 설치한다.

(참고 : [How to install Java on Ubuntu 18.04 Bionic Beaver Linux])

```bash
$ sudo add-apt-repository ppa:webupd8team/java
$ sudo apt-get update
$ sudo apt-get install oracle-java8-set-default
$ java --version # Java 설치 확인
```

## Install and Configure the ElasticSearch

ElasticSearch는 현재 Ubuntu 공식 패키지 저장소에서 제공되지 않는다. 따라서, Debian Package를 직접 다운받아 설치하는 것과, Elastic의 Source List를 추가하여, apt를 통해 설치하는 방법이 있다. 
패키지 관리의 편의성을 위해 apt를 통해 설치하는 방법을 사용한다. 

우선은, ElasticSearch GPG key를 임포트 한다. 

```bash
$ wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
OK
```

Elastic의 Source List를 sources.list.d 폴더에 추가한다. 

```bash
$ echo "deb https://artifacts.elastic.co/packages/6.x/apt stable main" | sudo tee -a /etc/apt/sources.list.d/elastic-6.x.list
deb https://artifacts.elastic.co/packages/6.x/apt stable main
```

APT 업데이트 및 elasticsearch를 설치

```bash
$ sudo apt update
$ sudo apt install elasticsearch
```

Elastic Search에 대한 외부 Access를 제한하기 위해, Elastic Search의 Configuration 파일의 network.host 값을 아래와 같이 수정한다.

```yml
network.host: localhost
```

Systemctl을 통해 elasticsearch 서비스를 실행하고, 서버 부팅 시 자동 실행되도록 한다.

```bash
$ sudo systemctl start elasticsearch
$ sudo systemctl enable elasticsearch
Synchronizing state of elasticsearch.service with SysV service script with /lib/systemd/systemd-sysv-install.
Executing: /lib/systemd/systemd-sysv-install enable elasticsearch
Created symlink /etc/systemd/system/multi-user.target.wants/elasticsearch.service → /usr/lib/systemd/system/elasticsearch.service.
```

Curl 명령어를 통해, elasticsearch의 동작 여부를 확인한다. 

```bash
$ curl -X GET "localhost:9200"
{
  "name" : "-cBxsVl",
  "cluster_name" : "elasticsearch",
  "cluster_uuid" : "zYITLxSjTo2Y_S6kUOvc6Q",
  "version" : {
    "number" : "6.7.1",
    "build_flavor" : "default",
    "build_type" : "deb",
    "build_hash" : "2f32220",
    "build_date" : "2019-04-02T15:59:27.961366Z",
    "build_snapshot" : false,
    "lucene_version" : "7.7.0",
    "minimum_wire_compatibility_version" : "5.6.0",
    "minimum_index_compatibility_version" : "5.0.0"
  },
  "tagline" : "You Know, for Search"
}
```

## Install and Configure the Kibana Dashboard


### Install Kibana

이전에 추가한 Elastic 패키지의 Source를 통해, kibana를 설치할 수 있다. elasticsearch와 마찬가지로, systemctl을 통해 서비스를 실행하고, 서버 부팅시 자동 실행되도록 한다.

```bash
$ sudo apt install kibana
$ sudo systemctl start kibana
$ sudo systemctl enable kibana
```

### Install and Configure Nginx

Kibana Dashboard를 Nginx를 통해 서빙할 것이므로, Nginx를 설치한다. 간단한 인증 기능을 함께 추가하기 위해 apache2-utils 패키지도 함께 설치한다.
Nginx에서 사용될 ID/Password를 설정한다.

```bash
$ sudo apt-get install -y nginx apache2-utils
$ sudo htpasswd -c /etc/nginx/htpasswd.users admin
```

Nginx의 Reverse Proxy를 설정한다. (여기서는 **example.com** 이라는 호스트명을 가정한다.)

```bash
$ sudo vi /etc/nginx/site-available/example.com

/etc/nginx/site-available/example.com
server {
    listen 80;

    server_name example.com;

    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/htpasswd.users;

    location / {
        proxy_pass http://localhost:5601;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

$ sudo ln -s /etc/nginx/sites-available/example.com /etc/nginx/sites-enabled/example.com
$ sudo nginx -t 
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful

$ sudo systemctl restart nginx
```

설치가 완료되면, **http://example.com/status** 로 접속해 kibana 동작 여부를 확인한다. 이때 로그인을 필요로 하는데, 위에서 생성한 아이디와 비밀번호를 사용한다.

![login](https://lh3.googleusercontent.com/xpfcnJKJUnbJ38VBx6KURkIC6VwspJydmLaurp1EE81I52r6fx6jr8HiwZEwzI-sxyCeAFnFuM8AY1ZX5cy3aBWA7aBqSfmj78OFYGK8uanQ7OLwFbFY0qbL48YVpfW8sJ0xH74G6-VXmp9PC_tvsuDIcctBr5jLkD32xDBtoPUxINZxProIsFwIdqGNbzSPo-_APxkr99DqDwAj4YMr3iPTUw2MGlCvmSd6rMEYj3E06UB_kvy7645iTnZm_vorKh9N1taSgUpLBfx5y1lIMRhr8bvXj2cQhTVL3dtvG7c5ejACzJp6LCbw_PMdw_i_fQYYBTV5nTb94o7AVTHtPyvBH4KsGwYWMGtpG_D_1grNMZrLZuIgrBAoCsQf747bxJHyCAhlEodd05UwEab-s2fcEIxV7onx9g8KHuU1Td1GiOcZqVc4hPixayTF9Tu_6SOsOqaB6L8aHHEHEZa-u8CNfvuhveIe0T7OBmIdcyHh22hWfaov7Q92LimTB9FsPBkq4S3_KwtMw7oRIUnkzYlrWwNBXsiXKsVgb8CxvTltj_Otkc4fGxl_Mi-bROMjD5v0w2lU-B62Rb0JUNIBVWsvQ0nSaqKiWZjgylmKg4OqMVs6FZzc9tSir-MvzzwsYKM4PaEAG5PGZ_vtvmJLGp_Y8G3WdrA=w1487-h694-no)
![kibana](https://lh3.googleusercontent.com/YsJCtkHvq7EVkksINDQRFzp9r81vz2_fwKQYqzMZFviVre6A50MxtaiVAJIop17KtTAa7zKznbpv4qvArcog_cWvN0n8X_6fZ7KZeqSvsqm4RnfEwt1cPUm2jPiOqGnzobWOxlGIG-AVPDJzzrUGH67rNgsGARMuGUybnSNLR2ZCSA7oZ71P4xJahqEad34J0lIbivi0uCiIozg0Xe6mtoRT79K-7-kIQI4E-yl_Azg8UTq8E5G0QiwPkDRtPCpOqRAFCgI_rfc2MVGEblTvD3XT_T8nzTSYbFhAkaXYITlOxVPuLHxTAFHD5Y7Gu9A64Pw_zNKnUymOIZJ0xqfFJ-8fcz9GIT3GV6V3zm9UeYk4P85FsUvW1E-_rmj1eaB0JV4M27XoKd0mAr5sr5G-9e2vgFL1Bg_auslG1fq5A3gEeINov1KghLlVYFnw4mECPYk1YInImNg7KX5y-d7tN-beWa8C4fXsLaUyhlSSx9hPKxfsQMq0yGPl1NxsslAAZDo9lLy07ylZccmaZw34s5AkfeHtifX_47zYbUgAorIYn9QZS3bxj4TKxR3Gw6W3Vuipc0F1MVXgx_dC8b75Ic7MNZlN_JP65Q5gP6_LL3_L9lYQsope8iyzjhSNGp_8pn9cfH-6YCyj-JZNSsQUWwUyLQL08RY=w1487-h945-no)

## Install and Configure Logstash

Logstash도 마찬가지로 APT를 통해 설치할 수 있다.

```bash
$ sudo apt install logstash
```

Logstash를 아래와 같이 설정한다. 

```bash
$ sudo vi /etc/logstash/conf.d/s3.conf

/etc/logstash/conf.d/s3.conf
input {
	s3 {
		bucket => "BUCKET_NAME"
		region => "REGION"
		access_key_id => "ACCESS_KEY_ID"
		secret_access_key => "ACCESS_KEY_SECRET"
	}
}

filter {
	grok {
		match => { "message" => "%{COMBINEDAPACHELOG}" } 
	}
}

output {
	elasticsearch {
			hosts => ["localhost:9200"]
			index => "elb_logs"
	}
}

$ sudo -u logstash /usr/share/logstash/bin/logstash --path.settings /etc/logstash -t  # Test Configure
```

Logstash 서버를 실행한다. 

```bash
$ sudo systemctl start logstash
```

## Validation

Logstash가 실행되고, 약간의 잠시 기다리면 kibana를 통해 로그 데이터가 elasticsearch에 반영되었음을 확인할 수 있다. 

**kibana > management > Index Patterns** 메뉴에서, **Create Index Pattern**버튼을 누르고, Logstash에서 설정한 index 이름(elb_logs)를 입력한다.

![kibana2](https://lh3.googleusercontent.com/vv_HHuoEVI9QqkqwYa2V1SE0_VXebE2P537ekWBDDKdLgtekFikrNwxLFNz5CYWK6so5oxny6_jtjJO7xj6sLpSfztUa5xI2sVYq8CDbyNYtR7plqK3DaejSvGIRIKkUvT_Ql1bLr4aF0rnEYiarLt3muar33It6NirBQKXwtKDDyM4Q2lvfSegpfVgqma9aLFZIM-9XsqnI4IwbWXICG0O12ileDs5usbZs57hKdHulDPAqPzDDGKgJ8MJA-h9Wfy_DMBM_soLASKomOZeeDtvjni_eRAxXrvCT73S9f74LxHZPpyA52zVpbToTIrRMGHhIC6DKpC09O_7cXIsM4pLn9w72wwLPT1oR9PJ2WfSk9s5-88Wb3nGTqdRxiNk8Y2pTwUkzKTY3VhoFmaUuEHRInjNjDdxzMaR7R8pxePD-12_n3xFn1MFvNM9YsY4byWx1muRc8uQpO2C60zEzE0wO9Kt4uduwchFVphgDlErw-fzW0JdGwrsgWSkwQsrHUbAai-QxBSp8p0DK7SfX9k_XiWuVY5_1o9EJUegdqe7_ZlmIGj4CtkUQYMwljZ5yhbqSDE5qn85RLv1p09r17nFhyYten4Tu7S4URB1PsTU4JNkinL8LYN72xveB-V4HVYnAzncZMgg1r9Cnsu1q7yygPi_8dPk=w1735-h946-no)
Index Pattern 생성

![kibana3](https://lh3.googleusercontent.com/pScUo4s9k4l3kQ19Cd6yeix6pGpzE8DdIgsO9teGuaZCYYhE-dOgWVZftvwfFQ38OxYfjhKHmnCcS5Gyg7cN6949zuTxIkBhLqvh-qCLxhZTGbVB8qflFQEpHsQIsy0w_wkIDYfKqvc1jjP0n6UcXjXmaJ6KUnhhIpsV4PSm-Ro02189cTSKnJUag2-p_1Jb2CI5RmstyQh9FReMqMQXjccUx4Zc58Z-8_ttiqFW6J3IZLBJWUibZE_4Mxxe-AGNnM7U6M4_uOClNqBEMOMuPZ_RM1zP9WouLiC1nGS3qv3hs6N56bcBdXqvHDp3Xf8wOyqgOKE2RrlyGLs367ke3m00-nPOCJuEduHrKQvOKbgGmE_hkKOt2LCyirSt4AVC0DFAVm_ef8jVBH0HIXqVALmCJ8gOACFe7bNsb9ddXojNi0vQG6_PsTfMvI9JCwxRkfWrFr8_BIRYL59FbuiA9OTQ21XcR_u5FUkBogHKKmIDjRrD0OziArE6B6Oyyc4H-BTNYuTkFYxvzE21SrMKJvmFQXRT0SdL6vfRLangbA5YCYqUjxAqAUasYe0bx-y1BnOb9uRaK8IudiJjsyr8OnIgIjHATIoZzTrX1mFiX5mwmfEi5QlTFTRooaN4wQeE0iOHzDLzf1IZBYvPvw4w6ruzN6TyWRE=w1748-h947-no)
Timestamp 필드 설정 

![kibana4](https://lh3.googleusercontent.com/gHW4sQbtOXD8hkYlQUqfNKXmVxWs9eY-faDQ6f9Y7W_3m2AAJKpjrXUodM_WzFUU4CgK1O-tIsb-vqIu_lOAP5bWZ4dPukmjkgt-08oV7MT3kzMSd4Chj0JJ-89iatp9fsP6sArfk7Q8ammuFK08FqOSrgPHst8fq85FlmPcMiBee7fWdgX25dfNHO_W2-J_ihvIF9COeIw1OblAnHwB94VYBCEslktfsqj-7l7alI04QhgvdyS2zTCIw_h3zgytB4n3jJzIswS3qSPcssKTNtCTNMBsgP2OE7Aseea9W1rbRPsq4K0fqkuzKnKu-BJPSRxj19XA7FNnaj71ygbtxfKc1_a41ol45Wqyuvdxjdwn10LWBbQmp4o_rkzHwPzzUuY48k7pzq-AWDsvFL4N42dpr7QgZBkkTPSY6ou2jaUczJm0xTy43pjD0IX3EmsrJ8S5nOr1ZJCGMglhnjk3ob-xXdMgjiQTzTWZayCjEtBju9BNlN4zcAw-dovYqYsqHeaJ9lmHow0NGFoHw_9PCK51QkQUQ0JRa-DxaZ_w9eR4gpoU6JV4JjdI7O-sS9FjkMGmJ7adGFwtfv3t53rEgH7_0cF3sNhHUeFWAZ47k-ZmMmdCenBYlc9ZQKfrjKamxQY91GV845xqx7eOi6P2qIt8VtTrU1M=w1763-h946-no)
**Discover** 메뉴에서 로그 데이터 확인

## References

[AWS ELB Logs from S3 on ELK stack],  
[How To Install Elasticsearch, Logstash, and Kibana on Ubuntu 18.04]


## Trouble Shooting

### [FORBIDDEN/12/index read-only / allow delete (api)] 오류

kibana에서 Index Pattern을 추가하려고 할 때, 아무런 반응이 일어나지 않는 경우, Chrome Developer 메뉴의 Console 출력을 보니 위와 같은 메세지가 있었다.
kibana에서 Index Pattern을 삭제하려고 할 때, 마찬가지의 메세지가 kibana 상에 출력되었다.

이 메세지는, 현재 인스턴스의 Disk Space가 특정 Threshold를 넘어가면, elasticsearch가 Read-Only 모드로 바뀌게 되어 발생하는 메세지로, 인스턴스의 디스크 크기를 늘려주고 아래와 같은 명령어를 **kibana > dev tool**에서 실행시켜줘야 한다. 

```
PUT _all/_settings
{
  "index": {
    "blocks": {
      "read_only_allow_delete": false
    }
  }
}
```

### grok Filter Customization

사전의 정의된 grok filter 외에도, 정규표현식/grok pattern 등을 활용 하여 필터링을 수행할 수 있다. 이때 [Grok Constructor]를 활용하여 쉽게 테스트해볼 수 있다.


[How to install Java on Ubuntu 18.04 Bionic Beaver Linux]: https://linuxconfig.org/how-to-install-java-on-ubuntu-18-04-bionic-beaver-linux
[AWS ELB Logs from S3 on ELK stack]: https://medium.com/sharmin-anee/aws-elb-logs-from-s3-on-elk-stack-c463e2e2ec0
[How To Install Elasticsearch, Logstash, and Kibana on Ubuntu 18.04]: https://www.digitalocean.com/community/tutorials/how-to-install-elasticsearch-logstash-and-kibana-elastic-stack-on-ubuntu-18-04
[Grok Constructor]: http://grokconstructor.appspot.com/do/match
